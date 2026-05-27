from pathlib import Path
import re
import duckdb
import narwhals as nw
from hereutil import here
from typing import Callable, cast
from tqdm.auto import tqdm

import pandas as pd

pd.set_option("display.max_rows", None)
pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)
pd.set_option("display.max_colwidth", None)

con = duckdb.connect(config=dict(parquet_metadata_cache=True, preserve_insertion_order=False, enable_fsst_vectors=True))
con.sql("SET enable_progress_bar=true;")

wd_claim_wikibase_entityid = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_descriptions = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_entities = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_labels = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_time = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_aliases = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_globecoordinate = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_monolingualtext = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)

c = nw.col
l = nw.lit

def to_narwhals(duckdb_table: duckdb.DuckDBPyRelation) -> nw.LazyFrame[duckdb.DuckDBPyRelation]:
    return nw.from_native(duckdb_table)

def read_parquet(table_name: str, *paths: Path) -> nw.LazyFrame[duckdb.DuckDBPyRelation]:
    if len(paths) == 1:
        files_sql = f"'{paths[0]}'"
    else:
        files_sql = "[" + ", ".join(f"'{p}'" for p in paths) + "]"
    con.sql(f"CREATE OR REPLACE VIEW {table_name} AS SELECT * FROM read_parquet({files_sql});")
    return to_narwhals(con.view(table_name))

groups: dict[str, list] = {}

print(here("data/work"))
print(here("data/work").exists())

for file in here(f"data/work").glob("*/*.parquet"):
    print(file)
    table_name = re.sub(r"_\d+$", "", file.stem)
    groups.setdefault(table_name, []).append(file)

for table_name, files in (pbar := tqdm(groups.items())):
    pbar.set_description(f"Registering {table_name}")
    globals()[table_name] = read_parquet(table_name, *files)
    print(f"{table_name} = cast(nw.LazyFrame[DuckDBPyRelation], None)")

def process_war(war_name):

    P31_INSTANCE_OF = 84
    P276_LOCATION = 2019

    # -------------------------------------------------------------------
    # STEP 1
    # Find entity by English label
    # -------------------------------------------------------------------

    war_entity = (
        wd_labels
        .filter(
            (c("language") == "en") &
            (c("label").str.to_lowercase() == war_name.lower())
        )

        .join(
            wd_entities,
            on="entity_id",
            how="inner"
        )

        .join(
            wd_descriptions.filter(c("language") == "en"),
            on="entity_id",
            how="left"
        )

        .select(
            "entity_id",
            c("id").alias("wikidata_id"),
            "label",
            "description"
        )
    )

    print("\n=== MATCHING WAR ENTITY ===")
    print(war_entity.collect())

    # -------------------------------------------------------------------
    # Extract internal entity_id
    # -------------------------------------------------------------------

    war_df = war_entity.collect().to_pandas()

    if len(war_df) == 0:
        raise ValueError(f"No entity found for: {war_name}")

    ENTITY_ID = int(war_df.iloc[0]["entity_id"])

    print("\nResolved ENTITY_ID:", ENTITY_ID)

    # -------------------------------------------------------------------
    # STEP 2
    # Get all entity-valued claims for this war
    # -------------------------------------------------------------------

    claims = (
        wd_claim_wikibase_entityid
        .filter(c("entity_id") == ENTITY_ID)
    )

    # -------------------------------------------------------------------
    # STEP 3
    # Resolve instance_of
    # -------------------------------------------------------------------

    instance_of = (
        claims

        .filter(c("property_id") == P31_INSTANCE_OF)

        .join(
            wd_entities,
            left_on="value_entity_id",
            right_on="entity_id",
            how="inner"
        )

        .join(
            wd_labels.filter(c("language") == "en"),
            left_on="value_entity_id",
            right_on="entity_id",
            how="left"
        )

        .select(
            c("id").alias("instance_of_qid"),
            c("label").alias("instance_of")
        )
    )

    print("\n=== INSTANCE OF ===")
    print(instance_of.collect())

    # -------------------------------------------------------------------
    # STEP 4
    # Resolve locations
    # -------------------------------------------------------------------

    locations = (
        claims

        .filter(c("property_id") == P276_LOCATION)

        .join(
            wd_entities,
            left_on="value_entity_id",
            right_on="entity_id",
            how="inner"
        )

        .join(
            wd_labels.filter(c("language") == "en"),
            left_on="value_entity_id",
            right_on="entity_id",
            how="left"
        )

        .select(
            c("id").alias("location_qid"),
            c("label").alias("location")
        )
    )

    print("\n=== LOCATIONS ===")
    print(locations.collect())

    test_claims = (
        wd_claim_wikibase_entityid
        .filter(c("entity_id") == ENTITY_ID)
        .select(
            "property_id",
            "value_entity_id"
        )
    )

    all_claims = (
        wd_claim_wikibase_entityid
        .filter(c("entity_id") == ENTITY_ID)
    )

    print(all_claims.to_native().df())

    print(test_claims.to_native().df())

    property_ids = (
        all_claims
        .select("property_id")
        .unique()
    )

    print(property_ids.to_native().df())

    resolved_properties = (
        property_ids

        .join(
            wd_entities,
            left_on="property_id",
            right_on="entity_id",
            how="inner"
        )

        .join(
            wd_labels.filter(c("language") == "en"),
            left_on="property_id",
            right_on="entity_id",
            how="left"
        )

        .select(
            "property_id",
            "id",
            "label"
        )
    )

    print(resolved_properties.to_native().df())
 
if __name__ == "__main__":
    print(process_war("Great Northern War"))