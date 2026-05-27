import os
import re
import json
import yaml
import numpy as np
import pandas as pd
import networkx as nx
from networkx.algorithms import bipartite
from tqdm import tqdm
from adbc_driver_gizmosql import dbapi
from sqlframe_gizmosql import GizmoSQLSession
import sqlframe_gizmosql.functions as F
import sqlframe_gizmosql.functions as c
from hereutil import here

# ═══════════════════════════════════════════════════════════════════════════
# 1. SETUP & PATHS
# ═══════════════════════════════════════════════════════════════════════════
city = "jena"
work_dir = here("data/work")
os.makedirs(work_dir, exist_ok=True)

raw_output_path = work_dir / f"vd_all_{city}.jsonl"
stats_output_path = work_dir / f"{city}_stats.json"

# Load database config
with here("db_secret.yaml").open('r') as yaml_file:
    db_params = yaml.safe_load(yaml_file)

# ═══════════════════════════════════════════════════════════════════════════
# 2. CLEANING HELPERS
# ═══════════════════════════════════════════════════════════════════════════
def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def clean_author(text):
    if not text:
        return ""
    # Extract all key-value pairs in their exact sequential order
    pairs = dict(re.findall(r'([^|$]+)\$([^|]*)', text.lower()))
    
    author = ''
    if any(k in pairs for k in ('7', 'a', 'd', 'p')):
        author_name = ''.join([
            clean_text(pairs.get('p', '')).replace(' ', ''), 
            clean_text(pairs.get('a', '')).replace(' ', ''), 
            clean_text(pairs.get('d', '')).replace(' ', '')
        ])
        author = ', '.join([pairs.get('7', ''), author_name])
    return author

def gini(array):
    """Calculate the Gini coefficient of a numpy array."""
    array = np.asarray(array, dtype=np.float64)
    if len(array) == 0:
        return 0.0
    if np.amin(array) < 0:
        raise ValueError("Gini coefficient only defined for non-negative arrays")
    if np.sum(array) == 0:
        return 0.0
    array = np.sort(array)
    index = np.arange(1, array.shape[0] + 1)
    n = array.shape[0]
    return ((2 * np.sum(index * array)) / (n * np.sum(array))) - ((n + 1) / n)

def get_distance_stats_nx(G, statistic_func=np.mean):
    """Calculate the average shortest path distance between publishers and authors in the LCC."""
    if len(G) == 0:
        return 0.0
    components = sorted(nx.connected_components(G), key=len, reverse=True)
    if not components:
        return 0.0
    lcc = G.subgraph(components[0]).copy()
    
    publishers = [n for n, d in lcc.nodes(data=True) if d.get('bipartite') == 1]
    
    if not publishers:
        return 0.0
        
    # Sample a subset of publishers if the set is very large (e.g., in massive networks)
    # to maintain fast computation while preserving highly accurate distance estimates.
    if len(publishers) > 50:
        import random
        # Seed for reproducible random sampling
        random.seed(42)
        publishers = random.sample(publishers, 50)
        
    dists = []
    for p in publishers:
        paths = nx.single_source_shortest_path_length(lcc, p)
        # In a bipartite graph, path lengths from publishers to authors are always odd (1, 3, 5, etc.)
        # and path lengths to other publishers are always even (0, 2, 4, etc.).
        # This allows us to instantly filter author nodes without node-type dictionary lookups.
        dists.extend(dist for dist in paths.values() if dist % 2 == 1)
    return statistic_func(dists) if dists else 0.0

def get_bipartite_clustering_nx(G, sample_size=100):
    """Calculate the average bipartite clustering coefficient using node sampling for speed."""
    if len(G) == 0:
        return 0.0
    nodes = list(G.nodes())
    if len(nodes) > sample_size:
        import random
        # Seed for reproducible random sampling
        random.seed(42)
        nodes = random.sample(nodes, sample_size)
    return bipartite.average_clustering(G, nodes=nodes)

def randomize_bipartite_nx(B):
    """Generate a randomized bipartite configuration model network."""
    publishers = [n for n, d in B.nodes(data=True) if d.get('bipartite') == 1]
    authors = [n for n, d in B.nodes(data=True) if d.get('bipartite') == 0]
    
    # Map nodes to indices for bipartite configuration model
    pub_to_idx = {node: i for i, node in enumerate(publishers)}
    auth_to_idx = {node: i for i, node in enumerate(authors)}
    
    aseq = [B.degree(n) for n in publishers]
    bseq = [B.degree(n) for n in authors]
    
    # nx.bipartite.configuration_model returns a multigraph with node sets:
    # 0 to len(aseq)-1 (representing publishers) and len(aseq) to len(aseq)+len(bseq)-1 (representing authors)
    R_multi = bipartite.configuration_model(aseq, bseq, create_using=nx.Graph())
    
    # Map back to networkx graph
    R = nx.Graph()
    for n in range(len(aseq)):
        R.add_node(n, bipartite=1)
    for n in range(len(aseq), len(aseq) + len(bseq)):
        R.add_node(n, bipartite=0)
        
    for u, v in R_multi.edges():
        R.add_edge(u, v)
        
    return R

# ═══════════════════════════════════════════════════════════════════════════
# 3. DATA EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════
import time
import polars as pl
from adbc_driver_gizmosql import dbapi

print(f"Connecting to database to extract Jena publications...")
t_start = time.time()
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as db_con:
    with db_con.cursor() as cur:
        print("Executing SQL query directly via ADBC...")
        query = f"""
            SELECT 
                p.record_number,
                p.source,
                p.place_of_publication,
                a.value AS actor_value,
                pub.publisher,
                y.year_of_publication,
                l.primary_language_code
            FROM books.all_places_of_publication p
            INNER JOIN books.all_individual_actors a ON p.record_number = a.record_number AND p.source = a.source
            LEFT JOIN books.all_publishers pub ON p.record_number = pub.record_number AND p.source = pub.source
            LEFT JOIN books.all_years_of_publication y ON p.record_number = y.record_number AND p.source = y.source
            LEFT JOIN books.all_primary_languages l ON p.record_number = l.record_number AND p.source = l.source
            WHERE p.source IN ('vd16', 'vd17', 'vd18')
              AND p.place_of_publication ILIKE '%{city}%'
        """
        cur.execute(query)
        print("Fetching results...")
        table = cur.fetch_arrow_table()
        df_pl = pl.from_arrow(table)
        df_raw = df_pl.to_pandas()

print(f"Query completed in {time.time() - t_start:.2f} seconds. Retrieved {len(df_raw):,} raw records.")

# Clean data
print("Cleaning data...")
df_cleaned = pd.DataFrame()
df_cleaned['author'] = df_raw['actor_value'].apply(lambda x: clean_author(str(x)) if pd.notna(x) else '')
df_cleaned['publisher'] = df_raw['publisher'].apply(lambda x: clean_text(x) if pd.notna(x) else '')
df_cleaned['year'] = df_raw['year_of_publication']
df_cleaned['lang'] = df_raw['primary_language_code']
df_cleaned['rec_num'] = df_raw['record_number']

# Keep only rows with non-empty author and publisher
df_cleaned = df_cleaned[(df_cleaned['author'] != '') & (df_cleaned['publisher'] != '')].reset_index(drop=True)
print(f"Cleaned dataset has {len(df_cleaned):,} valid publisher-author relations.")

# Save to JSONL
df_cleaned[['rec_num', 'author', 'publisher', 'year', 'lang']].to_json(
    raw_output_path, lines=True, orient='records'
)
print(f"Saved raw data to {raw_output_path}")

# Initialize time windows
time_edges = np.linspace(1500, 1800, 11)
t_windows = []
i = 0
while i < len(time_edges) - 1:
    start = int(time_edges[i])
    end = int(time_edges[i+1] - 1)
    t_windows.append((start, end))
    i += 1

all_results = {}
for start, end in t_windows:
    window_key = f"{start}-{end}"
    all_results[window_key] = {
        'status': None,
        'updeg_gini': None,
        'lowdeg_gini': None,
        'clustering': {
            'obs': None,
            'coef_mean': None,
            'coef_lb': None,
            'coef_ub': None
        },
        'distance': {
            'obs': None,
            'coef_mean': None,
            'coef_lb': None,
            'coef_ub': None
        }
    }

# ═══════════════════════════════════════════════════════════════════════════
# 4. TEMPORAL NETWORK ANALYSIS USING NETWORKX
# ═══════════════════════════════════════════════════════════════════════════
print("\nRunning temporal network analysis...")
niter = 20  # Number of random configurations

for start, end in t_windows:
    window_key = f"{start}-{end}"
    print(f"\n--- Processing Window: {window_key} ---")
    
    # Filter for the current time window
    elist = df_cleaned[df_cleaned['year'].between(start, end)]
    if len(elist) == 0:
        print(f"No records found for window {window_key}. Skipping.")
        all_results[window_key]['status'] = 'skipped_empty'
        continue
        
    elist = elist.groupby(by=["publisher", "author"])["year"].nunique().reset_index()
    print(f"Unique edges: {len(elist):,}")
    
    # Build NetworkX Bipartite Graph
    B = nx.Graph()
    publishers = elist["publisher"].unique()
    authors = elist["author"].unique()
    B.add_nodes_from(publishers, bipartite=1)
    B.add_nodes_from(authors, bipartite=0)
    
    edges = [(row.publisher, row.author, row.year) for row in elist.itertuples()]
    B.add_weighted_edges_from(edges)
    
    # Degree Gini
    upper_degrees = [B.degree(n) for n in publishers]
    lower_degrees = [B.degree(n) for n in authors]
    
    updeg_gini = float(gini(upper_degrees))
    lowdeg_gini = float(gini(lower_degrees))
    print(f"Publisher Degree Gini: {updeg_gini:.3f}")
    print(f"Author Degree Gini: {lowdeg_gini:.3f}")
    
    # Bipartite Clustering
    obs_clustering = get_bipartite_clustering_nx(B)
    print(f"Observed Bipartite Clustering: {obs_clustering:.4f}")
    
    # LCC Shortest Path Distance
    obs_dist = get_distance_stats_nx(B)
    print(f"Observed LCC Avg Path Distance: {obs_dist:.3f}")
    
    # Run null model simulations
    print(f"Simulating {niter} random configuration networks...")
    rand_clusterings = []
    rand_dists = []
    
    for _ in range(niter):
        try:
            # Generate random bipartite configuration model
            R = randomize_bipartite_nx(B)
            
            # Bipartite clustering on random graph
            rc = get_bipartite_clustering_nx(R)
            rand_clusterings.append(rc)
            
            # Bipartite distance on random graph
            rd = get_distance_stats_nx(R)
            rand_dists.append(rd)
        except Exception as e:
            # If degree sequence has issues, skip iteration
            continue
            
    if not rand_clusterings or not rand_dists:
        print("Simulation failed to generate valid models. Skipping metrics ratios.")
        all_results[window_key]['status'] = 'completed_no_ratios'
        all_results[window_key]['updeg_gini'] = updeg_gini
        all_results[window_key]['lowdeg_gini'] = lowdeg_gini
        all_results[window_key]['clustering']['obs'] = obs_clustering
        all_results[window_key]['distance']['obs'] = obs_dist
        continue
        
    # Calculate ratios (observed / random)
    # Handle division by zero/NaNs safely
    cluster_estimates = []
    for rc in rand_clusterings:
        if rc > 0:
            cluster_estimates.append(obs_clustering / rc)
        else:
            cluster_estimates.append(0.0)
            
    dist_estimates = []
    for rd in rand_dists:
        if rd > 0:
            dist_estimates.append(obs_dist / rd)
        else:
            dist_estimates.append(0.0)
            
    # Save results
    all_results[window_key]['status'] = 'completed'
    all_results[window_key]['updeg_gini'] = updeg_gini
    all_results[window_key]['lowdeg_gini'] = lowdeg_gini
    
    all_results[window_key]['clustering']['obs'] = obs_clustering
    all_results[window_key]['clustering']['coef_mean'] = float(np.mean(cluster_estimates))
    all_results[window_key]['clustering']['coef_lb'] = float(np.quantile(cluster_estimates, q=.05))
    all_results[window_key]['clustering']['coef_ub'] = float(np.quantile(cluster_estimates, q=.95))
    
    all_results[window_key]['distance']['obs'] = obs_dist
    all_results[window_key]['distance']['coef_mean'] = float(np.mean(dist_estimates))
    all_results[window_key]['distance']['coef_lb'] = float(np.quantile(dist_estimates, q=.05))
    all_results[window_key]['distance']['coef_ub'] = float(np.quantile(dist_estimates, q=.95))
    
    print(f"Clustering Ratio: {all_results[window_key]['clustering']['coef_mean']:.3f}")
    print(f"Distance Ratio: {all_results[window_key]['distance']['coef_mean']:.3f}")

# Save JSON file
with open(stats_output_path, 'w') as f:
    json.dump(all_results, f, indent=2)

print(f"\nAll results saved to {stats_output_path}")
