import yaml
from adbc_driver_flightsql import dbapi
import polars as pl

def main():
    with open('/Volumes/United/DHH26/books-main/db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            for tbl in ["vd16", "vd17", "vd18"]:
                print(f"\n=========================================")
                print(f"Checking roles in books.{tbl}...")
                print(f"=========================================")
                
                # Check what roles are in 028C subfield B
                query_roles = f"""
                    SELECT value as role_name, COUNT(*) as count
                    FROM books.{tbl}
                    WHERE field_code = '028C' AND subfield_code = 'B'
                    GROUP BY role_name
                    ORDER BY count DESC
                    LIMIT 10
                """
                try:
                    cur.execute(query_roles)
                    roles_df = pl.from_arrow(cur.fetch_arrow_table())
                    print("Top 10 roles in 028C$B:")
                    print(roles_df)
                except Exception as e:
                    print(f"Error querying roles for {tbl}: {e}")
                
                # Also count occurrences where role is 'Zensor' or 'ZensorIn' or matches '%zensor%' (case-insensitive)
                query_zensor_count = f"""
                    SELECT COUNT(*)
                    FROM books.{tbl}
                    WHERE field_code = '028C' AND subfield_code = 'B' 
                      AND (LOWER(value) = 'zensor' OR LOWER(value) = 'zensorin' OR LOWER(value) LIKE '%zensor%')
                """
                try:
                    cur.execute(query_zensor_count)
                    z_count = cur.fetchone()[0]
                    print(f"Total rows with zensor role: {z_count}")
                    
                    if z_count > 0:
                        # Top names associated with this role
                        query_top_censors = f"""
                            SELECT 
                                name_val.value as censor_name,
                                count(*) as count
                            FROM books.{tbl} role_val
                            JOIN books.{tbl} name_val ON 
                                role_val.record_number = name_val.record_number 
                                AND role_val.field_number = name_val.field_number
                            WHERE 
                                role_val.field_code = '028C' AND role_val.subfield_code = 'B' 
                                AND (LOWER(role_val.value) = 'zensor' OR LOWER(role_val.value) = 'zensorin' OR LOWER(role_val.value) LIKE '%zensor%')
                                AND name_val.field_code = '028C' AND name_val.subfield_code = 'a'
                            GROUP BY censor_name
                            ORDER BY count DESC
                            LIMIT 10
                        """
                        cur.execute(query_top_censors)
                        censors_df = pl.from_arrow(cur.fetch_arrow_table())
                        print("Top 10 censors by name:")
                        print(censors_df)
                except Exception as e:
                    print(f"Error querying censor names for {tbl}: {e}")

if __name__ == '__main__':
    main()
