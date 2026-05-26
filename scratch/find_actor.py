import yaml
from adbc_driver_flightsql import dbapi
import polars as pl

def main():
    with open('db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            # Let's search for GND 129770205 in vd16, vd17, vd18
            gnd = "129770205"
            for tbl in ["vd16", "vd17", "vd18"]:
                print(f"\nSearching in books.{tbl} for GND {gnd}...")
                query = f"""
                    SELECT field_code, subfield_code, value, COUNT(*) as cnt
                    FROM books.{tbl}
                    WHERE record_number IN (
                        SELECT record_number 
                        FROM books.{tbl} 
                        WHERE value = '{gnd}'
                    )
                    AND field_code IN ('028C', '028A', '100', '700', '33A', '260', '264')
                    GROUP BY field_code, subfield_code, value
                    LIMIT 20
                """
                try:
                    cur.execute(query)
                    res = pl.from_arrow(cur.fetch_arrow_table())
                    print(res)
                except Exception as e:
                    print(f"Error: {e}")

if __name__ == '__main__':
    main()
