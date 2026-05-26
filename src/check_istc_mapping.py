from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        # Check rows in istc
        cur.execute("SELECT COUNT(*) FROM books.istc")
        print(f"Total rows in books.istc: {cur.fetch_arrow_table()}")
        
        # Check rows in e_id for source = 'istc'
        cur.execute("SELECT COUNT(*) FROM books.e_id WHERE source = 'istc'")
        print(f"Total rows in books.e_id for 'istc': {cur.fetch_arrow_table()}")
        
        # Check which sources are mapped to p_year_of_publication
        cur.execute("""
            SELECT e.source, COUNT(*) as count 
            FROM books.e_id e 
            JOIN books.p_year_of_publication y ON e.e_id = y.e_id 
            GROUP BY e.source
            ORDER BY count DESC
        """)
        print(f"Mapped year records by source: {cur.fetch_arrow_table()}")

