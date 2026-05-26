import yaml
from adbc_driver_flightsql import dbapi
import polars as pl
import re

def query_and_analyze():
    with open('/Volumes/United/DHH26/books-main/db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
        
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            
            # Query VD17 raw city and language counts
            print("Querying VD17...")
            query_vd17 = """
                SELECT 
                    y.year_of_publication,
                    v.value as raw_city,
                    l.primary_language_code,
                    COUNT(DISTINCT e.e_id) as count
                FROM books.vd17 v
                JOIN books.e_id e ON v.record_number = e.i_id AND e.source = 'vd17'
                JOIN books.p_year_of_publication y ON e.e_id = y.e_id
                LEFT JOIN books.p_primary_language l ON e.e_id = l.e_id
                WHERE v.field_code = '033D' AND v.subfield_code = 'p'
                  AND y.year_of_publication BETWEEN 1601 AND 1700
                GROUP BY y.year_of_publication, v.value, l.primary_language_code
            """
            cur.execute(query_vd17)
            vd17_df = pl.from_arrow(cur.fetch_arrow_table())
            
            # Query VD18 raw city and language counts
            print("Querying VD18...")
            query_vd18 = """
                SELECT 
                    y.year_of_publication,
                    v.value as raw_city,
                    l.primary_language_code,
                    COUNT(DISTINCT e.e_id) as count
                FROM books.vd18 v
                JOIN books.e_id e ON v.record_number = e.i_id AND e.source = 'vd18'
                JOIN books.p_year_of_publication y ON e.e_id = y.e_id
                LEFT JOIN books.p_primary_language l ON e.e_id = l.e_id
                WHERE v.field_code = '033D' AND v.subfield_code = 'p'
                  AND y.year_of_publication BETWEEN 1701 AND 1800
                GROUP BY y.year_of_publication, v.value, l.primary_language_code
            """
            cur.execute(query_vd18)
            vd18_df = pl.from_arrow(cur.fetch_arrow_table())
            
            # Combine datasets
            combined = pl.concat([vd17_df, vd18_df])
            print(f"Total raw city rows: {len(combined)}")
            
            # Normalize cities and assign confession
            def clean_and_classify(city_name):
                if not city_name:
                    return "Unknown", "Unknown"
                
                c = city_name.lower().strip()
                
                # Check city groups
                if "leipzig" in c:
                    return "Leipzig", "Protestant"
                elif "frankfurt" in c:
                    if "oder" in c:
                        return "Frankfurt (Oder)", "Protestant"
                    else:
                        return "Frankfurt am Main", "Mixed"
                elif "jena" in c:
                    return "Jena", "Protestant"
                elif "wittenberg" in c:
                    return "Wittenberg", "Protestant"
                elif "berlin" in c:
                    return "Berlin", "Protestant"
                elif "nürnberg" in c or "nuremberg" in c:
                    return "Nuremberg", "Protestant"
                elif "halle" in c:
                    return "Halle", "Protestant"
                elif "hamburg" in c:
                    return "Hamburg", "Protestant"
                elif "dresden" in c:
                    return "Dresden", "Protestant"
                elif "helmstedt" in c:
                    return "Helmstedt", "Protestant"
                elif "rostock" in c:
                    return "Rostock", "Protestant"
                elif "wien" in c or "vienna" in c:
                    return "Vienna", "Catholic"
                elif "straßburg" in c or "strasbourg" in c:
                    return "Strasbourg", "Mixed"
                elif "augsburg" in c:
                    return "Augsburg", "Mixed"
                elif "göttingen" in c or "goettingen" in c:
                    return "Göttingen", "Protestant"
                elif "tübingen" in c or "tuebingen" in c:
                    return "Tübingen", "Protestant"
                elif "erfurt" in c:
                    return "Erfurt", "Mixed"
                elif "köln" in c or "cologne" in c or "colonia" in c:
                    return "Cologne", "Catholic"
                elif "altdorf" in c:
                    return "Altdorf", "Protestant"
                elif "münchen" in c or "munich" in c:
                    return "Munich", "Catholic"
                elif "basel" in c or "basle" in c:
                    return "Basel", "Protestant"
                elif "königsberg" in c or "koenigsberg" in c:
                    return "Königsberg", "Protestant"
                elif "gießen" in c or "giessen" in c:
                    return "Giessen", "Protestant"
                else:
                    return "Other", "Other"

            # Apply classification
            classified_data = []
            for row in combined.iter_rows(named=True):
                city_clean, confession = clean_and_classify(row["raw_city"])
                if confession != "Other" and confession != "Unknown":
                    classified_data.append({
                        "year": row["year_of_publication"],
                        "city": city_clean,
                        "confession": confession,
                        "language": row["primary_language_code"] or "unknown",
                        "count": row["count"]
                    })
            
            classified_df = pl.DataFrame(classified_data)
            
            # Save raw classified dataset
            classified_df.write_csv("/Users/joonasluukkonen/.gemini/antigravity/brain/a03d5c4e-a9c0-4638-8b79-708f27d6c4a5/scratch/classified_cities_raw.csv")
            print("Raw classified data saved to scratch/classified_cities_raw.csv")
            
            # Aggregate by decade, confession, and language
            classified_df = classified_df.with_columns(
                ((pl.col("year") // 10) * 10).alias("decade")
            )
            
            # Decade aggregation of overall output per confession
            confession_decade = (
                classified_df
                .group_by(["decade", "confession"])
                .agg(pl.col("count").sum().alias("total_count"))
                .sort(["decade", "confession"])
            )
            confession_decade.write_csv("/Users/joonasluukkonen/.gemini/antigravity/brain/a03d5c4e-a9c0-4638-8b79-708f27d6c4a5/scratch/confession_decade.csv")
            print("Confessional output by decade saved to scratch/confession_decade.csv")
            
            # Language ratio (Latin vs German) in Catholic vs Protestant hubs by decade
            # Filter for lat and ger to look at the ratio
            lang_decade = (
                classified_df
                .filter(pl.col("language").is_in(["ger", "lat"]))
                .group_by(["decade", "confession", "language"])
                .agg(pl.col("count").sum().alias("total_count"))
                .sort(["decade", "confession", "language"])
            )
            lang_decade.write_csv("/Users/joonasluukkonen/.gemini/antigravity/brain/a03d5c4e-a9c0-4638-8b79-708f27d6c4a5/scratch/language_confession_decade.csv")
            print("Language distribution by confession and decade saved to scratch/language_confession_decade.csv")
            
            print("\n--- Summary of Confessional Output by Decade ---")
            print(confession_decade)

if __name__ == '__main__':
    query_and_analyze()
