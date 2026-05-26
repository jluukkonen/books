from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml
import polars as pl

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting to remote database...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        
        # --- EVOLUTION (CLEANED) ---
        print("\n=== TRACING 'EVOLUTION' CONCEPT (EXCLUDING REVOLUTION) ===")
        evolution_query = """
        SELECT 
            y.year_of_publication, 
            COUNT(*) as count
        FROM books.p_title t
        JOIN books.p_year_of_publication y ON t.e_id = y.e_id
        WHERE 
            (LOWER(t.main_title) LIKE '%evolution%' OR LOWER(t.main_title) LIKE '%evolutio%')
            AND LOWER(t.main_title) NOT LIKE '%revolution%'
            AND LOWER(t.main_title) NOT LIKE '%devolution%'
            AND y.year_of_publication > 1400 
            AND y.year_of_publication <= 2026
        GROUP BY y.year_of_publication
        ORDER BY y.year_of_publication ASC
        """
        cur.execute(evolution_query)
        evolution_df = pl.from_arrow(cur.fetch_arrow_table())
        total_evolution = evolution_df["count"].sum()
        print(f"Total matching books for 'Evolution': {total_evolution}")
        
        if total_evolution > 0:
            # Group by decade for clean display
            evolution_decades = (
                evolution_df
                .with_columns(((pl.col("year_of_publication") // 10) * 10).alias("decade"))
                .group_by("decade")
                .agg(pl.col("count").sum().alias("publications"))
                .sort("decade")
            )
            print("Timeline of 'Evolution' publications by decade (Top 15):")
            print(evolution_decades.tail(15))

        # --- NATURE ---
        print("\n=== TRACING 'NATURE' CONCEPT ===")
        nature_query = """
        SELECT 
            y.year_of_publication, 
            COUNT(*) as count
        FROM books.p_title t
        JOIN books.p_year_of_publication y ON t.e_id = y.e_id
        WHERE 
            (LOWER(t.main_title) LIKE '%nature%' OR LOWER(t.main_title) LIKE '%natura%' OR LOWER(t.main_title) LIKE '%natur%')
            AND y.year_of_publication > 1400 
            AND y.year_of_publication <= 2026
        GROUP BY y.year_of_publication
        ORDER BY y.year_of_publication ASC
        """
        cur.execute(nature_query)
        nature_df = pl.from_arrow(cur.fetch_arrow_table())
        total_nature = nature_df["count"].sum()
        print(f"Total matching books for 'Nature': {total_nature}")
        
        if total_nature > 0:
            # Group by decade for clean display
            nature_decades = (
                nature_df
                .with_columns(((pl.col("year_of_publication") // 10) * 10).alias("decade"))
                .group_by("decade")
                .agg(pl.col("count").sum().alias("publications"))
                .sort("decade")
            )
            print("Timeline of 'Nature' publications by decade (Top 15):")
            print(nature_decades.tail(15))

        # Save both results to CSV for potential visualizations later
        evolution_df.write_csv("evolution_timeline.csv")
        nature_df.write_csv("nature_timeline.csv")
        print("\nTimelines saved to 'evolution_timeline.csv' and 'nature_timeline.csv'")
