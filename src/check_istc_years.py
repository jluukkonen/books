from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        cur.execute("SELECT value, COUNT(*) as count FROM books.istc WHERE field_code = 'date_of_item_single_date' GROUP BY value ORDER BY count DESC LIMIT 15")
        print(cur.fetch_arrow_table())
