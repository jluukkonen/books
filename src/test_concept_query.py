from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml
import polars as pl

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting to remote database...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        # Search query for "evolution" or "evolut"
        query = """
        SELECT 
            t.e_id, 
            t.main_title, 
            y.year_of_publication, 
            l.primary_language_code
        FROM books.p_title t
        JOIN books.p_year_of_publication y ON t.e_id = y.e_id
        LEFT JOIN books.p_primary_language l ON t.e_id = l.e_id
        WHERE 
            LOWER(t.main_title) LIKE '%evolution%'
            OR LOWER(t.main_title) LIKE '%evolutio%'
        ORDER BY y.year_of_publication ASC
        LIMIT 50
        """
        print("Executing search query for 'evolution'...")
        cur.execute(query)
        table = cur.fetch_arrow_table()
        df = pl.from_arrow(table)
        
        print(f"\n--- Found {len(df)} sample historical books on 'evolution' ---")
        print(df)

