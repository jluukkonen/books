import yaml
from adbc_driver_flightsql import dbapi
import polars as pl

def main():
    with open('db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            # Check what fields have the year in books.vd17
            # Typically 011A$a is the publication year in PICA
            query = """
                SELECT field_code, subfield_code, value, COUNT(*) as cnt
                FROM books.vd17
                WHERE field_code LIKE '011%' OR field_code LIKE '033%'
                GROUP BY field_code, subfield_code, value
                LIMIT 15
            """
            cur.execute(query)
            df = pl.from_arrow(cur.fetch_arrow_table())
            print(df)

if __name__ == '__main__':
    main()
