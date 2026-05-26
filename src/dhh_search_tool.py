import argparse
import sys
import time
from hereutil import here
import yaml
import polars as pl
from adbc_driver_flightsql import dbapi

def main():
    parser = argparse.ArgumentParser(
        description="DHH26 Concept Search & Timeline Generator. Search titles for keywords and aggregate by year, country, and language."
    )
    parser.add_argument(
        "--concept", 
        required=True, 
        help="Name of the concept/topic (used for naming the output CSV)."
    )
    parser.add_argument(
        "--keywords", 
        required=True, 
        help="Comma-separated list of keywords to match in title (case-insensitive, e.g., 'democracy,democra,demokra')."
    )
    parser.add_argument(
        "--exclude", 
        default="", 
        help="Optional comma-separated list of keywords to exclude from matches (case-insensitive, e.g., 'revolution,devolution')."
    )
    parser.add_argument(
        "--output", 
        default="", 
        help="Optional path to output CSV file (defaults to '<concept>_results.csv' in root directory)."
    )
    
    args = parser.parse_args()
    
    concept_name = args.concept
    keywords = [k.strip().lower() for k in args.keywords.split(",") if k.strip()]
    exclusions = [e.strip().lower() for e in args.exclude.split(",") if e.strip()]
    
    if not keywords:
        print("Error: Please provide at least one keyword via --keywords.")
        sys.exit(1)
        
    # Build the WHERE conditions
    like_conditions = []
    for kw in keywords:
        like_conditions.append(f"LOWER(t.main_title) LIKE '%{kw}%'")
    where_clause = "(" + " OR ".join(like_conditions) + ")"
    
    if exclusions:
        not_like_conditions = []
        for excl in exclusions:
            not_like_conditions.append(f"LOWER(t.main_title) NOT LIKE '%{excl}%'")
        where_clause += " AND " + " AND ".join(not_like_conditions)
        
    query = f"""
    SELECT 
        y.year_of_publication,
        c.country_of_publication,
        l.primary_language_code,
        COUNT(*) as count
    FROM books.p_title t
    JOIN books.p_year_of_publication y ON t.e_id = y.e_id
    LEFT JOIN books.p_country_of_publication c ON t.e_id = c.e_id
    LEFT JOIN books.p_primary_language l ON t.e_id = l.e_id
    WHERE 
        {where_clause}
        AND y.year_of_publication > 1400 
        AND y.year_of_publication <= 2026
    GROUP BY y.year_of_publication, c.country_of_publication, l.primary_language_code
    ORDER BY y.year_of_publication ASC, count DESC
    """
    
    # Set default output path if not specified
    output_path = args.output
    if not output_path:
        output_path = here(f"{concept_name.lower().replace(' ', '_')}_timeline.csv")
        
    # Read database credentials
    db_secret_path = here("db_secret.yaml")
    try:
        with open(db_secret_path, "r") as f:
            db_params = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Error: db_secret.yaml not found at {db_secret_path}.")
        sys.exit(1)
        
    print(f"\nSearching for concept: '{concept_name}'")
    print(f"Keywords: {keywords}")
    if exclusions:
        print(f"Excluding: {exclusions}")
        
    print("Connecting to remote database...")
    start_time = time.time()
    
    try:
        with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
            with con.cursor() as cur:
                print("Running database query...")
                cur.execute(query)
                table = cur.fetch_arrow_table()
                df = pl.from_arrow(table)
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)
        
    duration = time.time() - start_time
    total_matches = df["count"].sum() if len(df) > 0 else 0
    
    print(f"Query completed in {duration:.2f} seconds.")
    print(f"Total matching books: {total_matches}")
    
    if total_matches == 0:
        print("No matching publications found.")
        sys.exit(0)
        
    # Write full dataset to CSV
    df.write_csv(output_path)
    print(f"Detailed timeline exported to: {output_path}")
    
    # Decade aggregation for preview
    preview_df = (
        df
        .with_columns(((pl.col("year_of_publication") // 10) * 10).alias("decade"))
        .group_by("decade")
        .agg(pl.col("count").sum().alias("publications"))
        .sort("decade")
    )
    
    print("\n--- Publication Timeline by Decade ---")
    print(preview_df)
    
    # Top country preview
    top_countries = (
        df
        .group_by("country_of_publication")
        .agg(pl.col("count").sum().alias("total"))
        .sort("total", descending=True)
        .head(5)
    )
    print("\n--- Top 5 Publishing Countries ---")
    print(top_countries)

    # Top language preview
    top_languages = (
        df
        .group_by("primary_language_code")
        .agg(pl.col("count").sum().alias("total"))
        .sort("total", descending=True)
        .head(5)
    )
    print("\n--- Top 5 Languages ---")
    print(top_languages)

if __name__ == "__main__":
    main()
