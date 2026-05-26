from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting to inspect field codes...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        # Check books.istc
        try:
            print("\n--- Top field codes in books.istc ---")
            cur.execute("SELECT field_code, COUNT(*) as count FROM books.istc GROUP BY field_code ORDER BY count DESC LIMIT 15")
            print(cur.fetch_arrow_table())
        except Exception as e:
            print(e)
            
        # Check books.fennica
        try:
            print("\n--- Top field codes in books.fennica ---")
            cur.execute("SELECT field_code, COUNT(*) as count FROM books.fennica GROUP BY field_code ORDER BY count DESC LIMIT 15")
            print(cur.fetch_arrow_table())
        except Exception as e:
            print(e)
