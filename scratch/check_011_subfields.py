import yaml
from adbc_driver_flightsql import dbapi
import polars as pl

def main():
    with open('db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            query = """
                SELECT subfield_code, value, COUNT(*) as cnt
                FROM books.vd17
                WHERE field_code = '011@'
                GROUP BY subfield_code, value
                ORDER BY cnt DESC
                LIMIT 30
            """
            cur.execute(query)
            df = pl.from_arrow(cur.fetch_arrow_table())
            print(df)

if __name__ == '__main__':
    main()
