import os
import re
import json
import yaml
import time
import numpy as np
import pandas as pd
import polars as pl
import networkx as nx
from networkx.algorithms import bipartite
from adbc_driver_gizmosql import dbapi
from hereutil import here

# ═══════════════════════════════════════════════════════════════════════════
# 1. SETUP & PATHS
# ═══════════════════════════════════════════════════════════════════════════
work_dir = here("data/work")
os.makedirs(work_dir, exist_ok=True)

# Load database config
with here("db_secret.yaml").open('r') as yaml_file:
    db_params = yaml.safe_load(yaml_file)

# 5 missing cities
city_patterns = {
    "leipzig": ["p.place_of_publication ILIKE '%leipzig%'"],
    "wittenberg": [
        "p.place_of_publication ILIKE '%wittenberg%'",
        "p.place_of_publication ILIKE '%witteberg%'",
        "p.place_of_publication ILIKE '%vitemberg%'",
        "p.place_of_publication ILIKE '%viteberg%'",
        "p.place_of_publication ILIKE '%witemberg%'"
    ],
    "köln": [
        "p.place_of_publication ILIKE '%köln%'",
        "p.place_of_publication ILIKE '%cologne%'",
        "p.place_of_publication ILIKE '%colonia%'"
    ],
    "augsburg": ["p.place_of_publication ILIKE '%augsburg%'"],
    "frankfurt": [
        "p.place_of_publication ILIKE '%frankfurt%' AND p.place_of_publication NOT ILIKE '%oder%'"
    ]
}

# ═══════════════════════════════════════════════════════════════════════════
# 2. HELPERS
# ═══════════════════════════════════════════════════════════════════════════
def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def clean_author(text):
    if not text:
        return ""
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
    if len(G) == 0:
        return 0.0
    components = sorted(nx.connected_components(G), key=len, reverse=True)
    if not components:
        return 0.0
    lcc = G.subgraph(components[0]).copy()
    publishers = [n for n, d in lcc.nodes(data=True) if d.get('bipartite') == 1]
    if not publishers:
        return 0.0
    if len(publishers) > 50:
        import random
        random.seed(42)
        publishers = random.sample(publishers, 50)
    dists = []
    for p in publishers:
        paths = nx.single_source_shortest_path_length(lcc, p)
        dists.extend(dist for dist in paths.values() if dist % 2 == 1)
    return statistic_func(dists) if dists else 0.0

def get_bipartite_clustering_nx(G, sample_size=100):
    if len(G) == 0:
        return 0.0
    nodes = list(G.nodes())
    if len(nodes) > sample_size:
        import random
        random.seed(42)
        nodes = random.sample(nodes, sample_size)
    return bipartite.average_clustering(G, nodes=nodes)

def randomize_bipartite_nx(B):
    publishers = [n for n, d in B.nodes(data=True) if d.get('bipartite') == 1]
    authors = [n for n, d in B.nodes(data=True) if d.get('bipartite') == 0]
    aseq = [B.degree(n) for n in publishers]
    bseq = [B.degree(n) for n in authors]
    R_multi = bipartite.configuration_model(aseq, bseq, create_using=nx.Graph())
    R = nx.Graph()
    for n in range(len(aseq)):
        R.add_node(n, bipartite=1)
    for n in range(len(aseq), len(aseq) + len(bseq)):
        R.add_node(n, bipartite=0)
    for u, v in R_multi.edges():
        R.add_edge(u, v)
    return R

# Time windows
time_edges = np.linspace(1500, 1800, 11)
t_windows = []
i = 0
while i < len(time_edges) - 1:
    t_windows.append((int(time_edges[i]), int(time_edges[i+1] - 1)))
    i += 1

# ═══════════════════════════════════════════════════════════════════════════
# 3. RUNNER FOR MISSING CITIES
# ═══════════════════════════════════════════════════════════════════════════
print(f"Connecting to database to extract missing cities...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as db_con:
    for city, conds in city_patterns.items():
        print(f"\n==================================================")
        print(f"PROCESSING MISSING CITY: {city.upper()}")
        print(f"==================================================")
        
        raw_output_path = work_dir / f"vd_all_{city}.jsonl"
        stats_output_path = work_dir / f"{city}_stats.json"
        
        # Build SQL condition
        where_clause = " OR ".join([f"({c})" for c in conds])
        
        t_start = time.time()
        with db_con.cursor() as cur:
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
                  AND ({where_clause})
            """
            cur.execute(query)
            table = cur.fetch_arrow_table()
            df_pl = pl.from_arrow(table)
            df_raw = df_pl.to_pandas()
            
        print(f"Query completed in {time.time() - t_start:.2f} seconds. Retrieved {len(df_raw):,} raw records.")
        
        if len(df_raw) == 0:
            print(f"No records retrieved for {city}. Skipping.")
            continue
            
        # Clean data
        print("Cleaning data...")
        df_cleaned = pd.DataFrame()
        df_cleaned['author'] = df_raw['actor_value'].apply(lambda x: clean_author(str(x)) if pd.notna(x) else '')
        df_cleaned['publisher'] = df_raw['publisher'].apply(lambda x: clean_text(x) if pd.notna(x) else '')
        df_cleaned['year'] = df_raw['year_of_publication']
        df_cleaned['lang'] = df_raw['primary_language_code']
        df_cleaned['rec_num'] = df_raw['record_number']
        
        df_cleaned = df_cleaned[(df_cleaned['author'] != '') & (df_cleaned['publisher'] != '')].reset_index(drop=True)
        print(f"Cleaned dataset has {len(df_cleaned):,} valid publisher-author relations.")
        
        # Save raw data
        df_cleaned[['rec_num', 'author', 'publisher', 'year', 'lang']].to_json(
            raw_output_path, lines=True, orient='records'
        )
        print(f"Saved raw data to {raw_output_path}")
        
        # Initialize stats structure
        all_results = {}
        for start, end in t_windows:
            window_key = f"{start}-{end}"
            all_results[window_key] = {
                'status': None,
                'updeg_gini': None,
                'lowdeg_gini': None,
                'clustering': {'obs': None, 'coef_mean': None, 'coef_lb': None, 'coef_ub': None},
                'distance': {'obs': None, 'coef_mean': None, 'coef_lb': None, 'coef_ub': None}
            }
            
        # Run temporal network calculations
        niter = 20
        for start, end in t_windows:
            window_key = f"{start}-{end}"
            elist = df_cleaned[df_cleaned['year'].between(start, end)]
            if len(elist) == 0:
                all_results[window_key]['status'] = 'skipped_empty'
                continue
                
            elist = elist.groupby(by=["publisher", "author"])["year"].nunique().reset_index()
            
            # Graph building
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
            
            # Clustering & Distance (Observed)
            obs_clustering = get_bipartite_clustering_nx(B)
            obs_dist = get_distance_stats_nx(B)
            
            # Null model simulations
            rand_clusterings = []
            rand_dists = []
            for _ in range(niter):
                try:
                    R = randomize_bipartite_nx(B)
                    rand_clusterings.append(get_bipartite_clustering_nx(R))
                    rand_dists.append(get_distance_stats_nx(R))
                except Exception:
                    continue
                    
            if not rand_clusterings or not rand_dists:
                all_results[window_key]['status'] = 'completed_no_ratios'
                all_results[window_key]['updeg_gini'] = updeg_gini
                all_results[window_key]['lowdeg_gini'] = lowdeg_gini
                all_results[window_key]['clustering']['obs'] = obs_clustering
                all_results[window_key]['distance']['obs'] = obs_dist
                continue
                
            # Compute ratios
            cluster_estimates = [obs_clustering / rc if rc > 0 else 0.0 for rc in rand_clusterings]
            dist_estimates = [obs_dist / rd if rd > 0 else 0.0 for rd in rand_dists]
            
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
            
        # Save results for city
        with open(stats_output_path, 'w') as f:
            json.dump(all_results, f, indent=2)
        print(f"Finished PROCESSING {city.upper()}. Saved to {stats_output_path}")

print("\nPROCESSING COMPLETED FOR ALL MISSING CITIES!")
