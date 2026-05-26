from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml
import polars as pl

with open(here("db_secret.yaml"), "r") as f:
    db_params = yaml.safe_load(f)

print("Connecting to remote database...")
with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
    with con.cursor() as cur:
        
        # --- EVOLUTION GEOGRAPHY & LANGUAGE ---
        print("\n=== TRACING 'EVOLUTION' GEOGRAPHY & LANGUAGE (EXCLUDING REVOLUTION) ===")
        evolution_query = """
        SELECT 
            y.year_of_publication,
            c.country_of_publication,
            l.primary_language_code,
            COUNT(*) as count
        FROM books.p_title t
        JOIN books.p_year_of_publication y ON t.e_id = y.e_id
        LEFT JOIN books.p_country_of_publication c ON t.e_id = c.e_id
        LEFT JOIN books.p_primary_language l ON t.e_id = l.e_id
        WHERE 
            (LOWER(t.main_title) LIKE '%evolution%' OR LOWER(t.main_title) LIKE '%evolutio%')
            AND LOWER(t.main_title) NOT LIKE '%revolution%'
            AND LOWER(t.main_title) NOT LIKE '%devolution%'
            AND y.year_of_publication > 1400 
            AND y.year_of_publication <= 2026
        GROUP BY y.year_of_publication, c.country_of_publication, l.primary_language_code
        ORDER BY y.year_of_publication ASC, count DESC
        """
        cur.execute(evolution_query)
        evolution_df = pl.from_arrow(cur.fetch_arrow_table())
        
        # Save to CSV
        evolution_df.write_csv("evolution_geography.csv")
        print("Detailed geographic data saved to 'evolution_geography.csv'")
        
        # Top Countries
        top_countries = (
            evolution_df
            .group_by("country_of_publication")
            .agg(pl.col("count").sum().alias("total_publications"))
            .sort("total_publications", descending=True)
        )
        print("\nTop 10 Publishing Countries for 'Evolution':")
        print(top_countries.head(10))
        
        # Top Languages
        top_languages = (
            evolution_df
            .group_by("primary_language_code")
            .agg(pl.col("count").sum().alias("total_publications"))
            .sort("total_publications", descending=True)
        )
        print("\nTop 10 Languages for 'Evolution':")
        print(top_languages.head(10))

        # --- NATURE GEOGRAPHY & LANGUAGE ---
        print("\n=== TRACING 'NATURE' GEOGRAPHY & LANGUAGE ===")
        nature_query = """
        SELECT 
            y.year_of_publication,
            c.country_of_publication,
            l.primary_language_code,
            COUNT(*) as count
        FROM books.p_title t
        JOIN books.p_year_of_publication y ON t.e_id = y.e_id
        LEFT JOIN books.p_country_of_publication c ON t.e_id = c.e_id
        LEFT JOIN books.p_primary_language l ON t.e_id = l.e_id
        WHERE 
            (LOWER(t.main_title) LIKE '%nature%' OR LOWER(t.main_title) LIKE '%natura%' OR LOWER(t.main_title) LIKE '%natur%')
            AND y.year_of_publication > 1400 
            AND y.year_of_publication <= 2026
        GROUP BY y.year_of_publication, c.country_of_publication, l.primary_language_code
        ORDER BY y.year_of_publication ASC, count DESC
        """
        cur.execute(nature_query)
        nature_df = pl.from_arrow(cur.fetch_arrow_table())
        
        # Save to CSV
        nature_df.write_csv("nature_geography.csv")
        print("Detailed geographic data saved to 'nature_geography.csv'")
        
        # Top Countries
        top_countries_nature = (
            nature_df
            .group_by("country_of_publication")
            .agg(pl.col("count").sum().alias("total_publications"))
            .sort("total_publications", descending=True)
        )
        print("\nTop 10 Publishing Countries for 'Nature':")
        print(top_countries_nature.head(10))
        
        # Top Languages
        top_languages_nature = (
            nature_df
            .group_by("primary_language_code")
            .agg(pl.col("count").sum().alias("total_publications"))
            .sort("total_publications", descending=True)
        )
        print("\nTop 10 Languages for 'Nature':")
        print(top_languages_nature.head(10))
