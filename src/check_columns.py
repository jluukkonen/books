from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting directly via DBAPI...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        print("\n--- Inspecting books.p_title schema ---")
        cur.execute("SELECT * FROM books.p_title LIMIT 2")
        print(cur.fetch_arrow_table())
        
        print("\n--- Inspecting books.p_year_of_publication schema ---")
        cur.execute("SELECT * FROM books.p_year_of_publication LIMIT 2")
        print(cur.fetch_arrow_table())
        
        print("\n--- Inspecting books.p_primary_language schema ---")
        cur.execute("SELECT * FROM books.p_primary_language LIMIT 2")
        print(cur.fetch_arrow_table())
