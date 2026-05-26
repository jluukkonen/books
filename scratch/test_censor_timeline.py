import yaml
from adbc_driver_flightsql import dbapi
import polars as pl

def main():
    with open('db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            # Let's count censor approvals by censor name, GND, and year
            query = """
                SELECT 
                    censor_occ.censor_surname,
                    censor_occ.censor_firstname,
                    censor_occ.gnd_val,
                    y.year_of_publication,
                    COUNT(DISTINCT censor_occ.record_number) as count
                FROM books.e_id e
                JOIN books.p_year_of_publication y ON e.e_id = y.e_id
                JOIN (
                    SELECT 
                        record_number,
                        -- Name parts
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
                ) censor_occ ON e.i_id = censor_occ.record_number AND e.source = 'vd17'
                WHERE y.year_of_publication >= 1500 AND y.year_of_publication <= 1800
                GROUP BY censor_occ.censor_surname, censor_occ.censor_firstname, censor_occ.gnd_val, y.year_of_publication
                ORDER BY count DESC
                LIMIT 20
            """
            print("Running query...")
            cur.execute(query)
            df = pl.from_arrow(cur.fetch_arrow_table())
            print("Censor temporal counts (sample):")
            print(df)

if __name__ == '__main__':
    main()
