from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml
import polars as pl
import time

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting to remote FlightSQL database...")
start_time = time.time()
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        # We query the entire publication volume grouped by year, country, and language
        query = """
        SELECT 
            y.year_of_publication,
            c.country_of_publication,
            l.primary_language_code,
            COUNT(*) as total_publications
        FROM books.p_year_of_publication y
        LEFT JOIN books.p_country_of_publication c ON y.e_id = c.e_id
        LEFT JOIN books.p_primary_language l ON y.e_id = l.e_id
        WHERE 
            y.year_of_publication > 1400 
            AND y.year_of_publication <= 2026
        GROUP BY 
            y.year_of_publication, 
            c.country_of_publication, 
            l.primary_language_code
        ORDER BY 
            y.year_of_publication ASC, 
            total_publications DESC
        """
        print("Executing baseline volume query... (This may take a few seconds on the server)")
        cur.execute(query)
        table = cur.fetch_arrow_table()
        df = pl.from_arrow(table)
        
        output_file = here("global_baseline.csv")
        df.write_csv(output_file)
        
        duration = time.time() - start_time
        print("\n--- Baseline Generation Completed ---")
        print(f"Time elapsed: {duration:.2f} seconds")
        print(f"Total baseline rows: {len(df)}")
        print(f"Total publications recorded: {df['total_publications'].sum()}")
        print(f"Saved to: {output_file}")
        
        print("\nFirst 10 rows of baseline dataset:")
        print(df.head(10))
