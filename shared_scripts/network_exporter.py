import argparse
import sys
import time
from hereutil import here
import yaml
import polars as pl
from adbc_driver_flightsql import dbapi

def main():
    parser = argparse.ArgumentParser(
        description="DHH26 Bipartite Network Exporter. Extract Author-Publisher networks for a bibliography and decade."
    )
    parser.add_argument(
        "--source", 
        required=True, 
        choices=["istc", "fennica", "hpb", "vd17", "vd18", "dnb", "estc"], 
        help="The bibliography source catalog to query (e.g., 'istc', 'fennica', 'hpb')."
    )
    parser.add_argument(
        "--decade", 
        type=int, 
        required=True, 
        help="The decade of interest (e.g., 1480, 1650, 1780)."
    )
    parser.add_argument(
        "--output", 
        default="", 
        help="Optional path to output CSV file (defaults to '<source>_<decade>_network.csv' in root)."
    )
    
    args = parser.parse_args()
    
    source = args.source.lower()
    decade = args.decade
    start_year = decade
    end_year = decade + 9
    
    # Select appropriate query based on the catalog type
    if source == "istc":
        query = f"""
        SELECT 
            TRIM(a.value) as source_author,
            TRIM(p.value) as target_publisher,
            TRY_CAST(y.value AS INTEGER) as year_of_publication,
            COUNT(*) as weight
        FROM books.istc a
        JOIN books.istc p ON a.record_number = p.record_number
        JOIN books.istc y ON a.record_number = y.record_number
        WHERE 
            a.field_code = 'author'
            AND p.field_code = 'imprint'
            AND y.field_code = 'date_of_item_single_date'
            AND TRY_CAST(y.value AS INTEGER) >= {start_year} AND TRY_CAST(y.value AS INTEGER) <= {end_year}
            AND TRIM(a.value) != '' AND TRIM(p.value) != ''
        GROUP BY source_author, target_publisher, year_of_publication
        ORDER BY weight DESC
        """
    else:
        query = f"""
        SELECT 
            TRIM(a.value) as source_author,
            TRIM(p.value) as target_publisher,
            y.year_of_publication,
            COUNT(*) as weight
        FROM books.{source} a
        JOIN books.{source} p ON a.record_number = p.record_number
        JOIN books.e_id e ON e.i_id = a.record_number AND e.source = '{source}'
        JOIN books.p_year_of_publication y ON e.e_id = y.e_id
        WHERE 
            a.field_code = '100' AND a.subfield_code = 'a'
            AND p.field_code IN ('260', '264') AND p.subfield_code = 'b'
            AND y.year_of_publication >= {start_year} AND y.year_of_publication <= {end_year}
            AND TRIM(a.value) != '' AND TRIM(p.value) != ''
        GROUP BY source_author, target_publisher, y.year_of_publication
        ORDER BY weight DESC
        """
    
    output_path = args.output
    if not output_path:
        output_path = here(f"{source}_{decade}_network.csv")
        
    db_secret_path = here("db_secret.yaml")
    try:
        with open(db_secret_path, "r") as f:
            db_params = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Error: db_secret.yaml not found at {db_secret_path}.")
        sys.exit(1)
        
    print(f"\nExtracting Author-Publisher network for source '{source}' in the {decade}s...")
    print(f"Years: {start_year} - {end_year}")
    print("Connecting to remote database...")
    start_time = time.time()
    
    try:
        with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
            with con.cursor() as cur:
                print("Running database query... (This may take a moment for larger datasets)")
                cur.execute(query)
                table = cur.fetch_arrow_table()
                df = pl.from_arrow(table)
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)
        
    duration = time.time() - start_time
    total_edges = df["weight"].sum() if len(df) > 0 else 0
    unique_links = len(df)
    
    print(f"Query completed in {duration:.2f} seconds.")
    print(f"Found {unique_links} unique author-publisher links (representing {total_edges} publications).")
    
    if unique_links == 0:
        print("No network connections found for the selected parameters.")
        sys.exit(0)
        
    # Standardize edge-list headers for Gephi / NetworkX
    gephi_df = df.rename({
        "source_author": "Source",
        "target_publisher": "Target",
        "weight": "Weight"
    })
    
    # Save network file
    gephi_df.write_csv(output_path)
    print(f"Network edge-list exported to: {output_path}")
    
    print("\nTop 10 most frequent Author-Publisher relationships:")
    print(gephi_df.head(10))
    
    # Summary stats on unique nodes
    unique_authors = gephi_df["Source"].n_unique()
    unique_publishers = gephi_df["Target"].n_unique()
    print(f"\nNetwork Summary: {unique_authors} unique authors and {unique_publishers} unique publishers.")

if __name__ == "__main__":
    main()
