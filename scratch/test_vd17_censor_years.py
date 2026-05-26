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
                SELECT 
                    censor_occ.censor_surname,
                    censor_occ.censor_firstname,
                    censor_occ.gnd_val,
                    yr.value as year_val,
                    COUNT(DISTINCT censor_occ.record_number) as count
                FROM books.vd17 yr
                JOIN (
                    SELECT 
                        record_number,
                        COALESCE(
                            MAX(CASE WHEN subfield_code = 'a' THEN value END),
                            MAX(CASE WHEN subfield_code = 'P' THEN value END)
                        ) as censor_surname,
                        MAX(CASE WHEN subfield_code = 'd' THEN value END) as censor_firstname,
                        MAX(CASE WHEN subfield_code = '7' THEN value END) as gnd_val
                    FROM books.vd17
                    WHERE field_code = '028C'
                    GROUP BY record_number, field_number
                    HAVING MAX(CASE WHEN subfield_code = 'B' THEN value END) IN ('Zensor', 'ZensorIn')
                ) censor_occ ON yr.record_number = censor_occ.record_number
                WHERE yr.field_code = '011@' AND yr.subfield_code = 'a'
                GROUP BY censor_occ.censor_surname, censor_occ.censor_firstname, censor_occ.gnd_val, yr.value
                ORDER BY count DESC
                LIMIT 30
            """
            print("Running query...")
            cur.execute(query)
            df = pl.from_arrow(cur.fetch_arrow_table())
            print(df)

if __name__ == '__main__':
    main()
