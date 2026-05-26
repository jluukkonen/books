from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        cur.execute("SELECT * FROM books.p_country_of_publication LIMIT 2")
        print(cur.fetch_arrow_table())
