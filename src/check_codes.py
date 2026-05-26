import polars as pl
from hereutil import here

df = pl.read_csv(here("global_baseline.csv"))

countries = df.group_by("country_of_publication").agg(pl.col("total_publications").sum().alias("count")).sort("count", descending=True)
print("=== ALL UNIQUE COUNTRY CODES (top 50) ===")
with pl.Config(tbl_rows=50):
    print(countries.head(50))

languages = df.group_by("primary_language_code").agg(pl.col("total_publications").sum().alias("count")).sort("count", descending=True)
print("\n=== ALL UNIQUE LANGUAGE CODES (top 50) ===")
with pl.Config(tbl_rows=50):
    print(languages.head(50))
