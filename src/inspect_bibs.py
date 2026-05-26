from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting to inspect bibliography tables...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        for table in ["istc", "fennica", "hpb"]:
            try:
                print(f"\n--- Columns in books.{table} ---")
                cur.execute(f"SELECT * FROM books.{table} LIMIT 1")
                arrow_t = cur.fetch_arrow_table()
                print(arrow_t.schema)
            except Exception as e:
                print(f"Could not read books.{table}: {e}")
