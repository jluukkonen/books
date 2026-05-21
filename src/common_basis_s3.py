import os
from pathlib import Path
import re
from typing import Callable, cast
import duckdb
import narwhals as nw
from hereutil import here
import sqlglot
import yaml
from tqdm.auto import tqdm

with here("db_secret.yaml").open('r') as yaml_file:
    db_params = yaml.safe_load(yaml_file)

os.environ["AWS_ACCESS_KEY_ID"] = db_params['aws_access_key_id']
os.environ["AWS_SECRET_ACCESS_KEY"] = db_params['aws_secret_access_key']

con = duckdb.connect(config=dict(parquet_metadata_cache=True, preserve_insertion_order=False, enable_fsst_vectors=True))
con.sql("SET enable_progress_bar=true;")
con.sql(f"CREATE SECRET ( TYPE s3, KEY_ID '{db_params['aws_access_key_id']}', SECRET '{db_params['aws_secret_access_key']}', ENDPOINT 'a3s.fi' );")

bnf = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
cerl_thesaurus = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
cnb = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
dbnf = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
dnb = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
erb = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
e_id = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
fennica = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
foo = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
geonames = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
geonames_alternate_names = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
gnd = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
hpb = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
idloc = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
isni_authority_ids = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
isni_core = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
isni_deprecated_isnis = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
isni_names = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
isni_same_as = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
isni_source_ids = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
istc = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
kbnl = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
kbse = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
melinda = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
natdk = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
natno = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
plnb = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
ptnb = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
p_cataloguing_date = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
p_country_of_publication = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
p_last_modification_datetime = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
p_primary_language = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
p_title = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
p_year_of_publication = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
stcv = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
tgn = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
ulan = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
vd17 = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
vd18 = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
viaf = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_aliases = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_globecoordinate = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_monolingualtext = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_no_value = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_quantity = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_some_value = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_string = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_time = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_claim_wikibase_entityid = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_datatypes = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_descriptions = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_entities = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_labels = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_globecoordinate = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_monolingualtext = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_no_value = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_quantity = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_some_value = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_string = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_time = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_qualifier_wikibase_entityid = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_globecoordinate = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_monolingualtext = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_no_value = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_quantity = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_some_value = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_string = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_time = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_reference_wikibase_entityid = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_sitelinks = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
wd_sitelink_badges = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)
collection_info = cast(nw.LazyFrame[duckdb.DuckDBPyRelation], None)

c = nw.col
l = nw.lit

def to_narwhals(duckdb_table: duckdb.DuckDBPyRelation) -> nw.LazyFrame[duckdb.DuckDBPyRelation]:
    return nw.from_native(duckdb_table)

def to_duckdb(narwhals_frame: nw.LazyFrame[duckdb.DuckDBPyRelation]) -> duckdb.DuckDBPyRelation:
    return narwhals_frame.to_native()

def format_sql(query: str, read:str = 'duckdb', write:str = 'duckb') -> str:
    return sqlglot.transpile(query, read=read, write=write, pretty=True)[0]

def to_parquet(table_name: str, lnf: nw.LazyFrame[duckdb.DuckDBPyRelation]) -> nw.LazyFrame[duckdb.DuckDBPyRelation]:
    with con.cursor() as cur:
        cur.execute(f"COPY ({to_duckdb(lnf).sql_query()}) TO 's3://dhh26/books/{table_name}.parquet' (FORMAT 'parquet', COMPRESSION 'ZSTD')")
        cur.execute(f"CREATE OR REPLACE VIEW books.{table_name} AS SELECT * FROM read_parquet('s3://dhh26/books/{table_name}.parquet')")
    return nw.from_native(duckdb.table(f'books.{table_name}'))    

def f(dataset: str) -> nw.LazyFrame[duckdb.DuckDBPyRelation]:
    return cast(nw.LazyFrame[duckdb.DuckDBPyRelation], globals()[dataset] if dataset in globals() else None) 

def iter_datasets(func: Callable[[str, str], None]):
    for row in (pbar := tqdm(list(collection_info.collect(backend='polars').iter_rows(named=True)))):
        dataset = row['dataset']
        standard = row['standard']
        pbar.set_description(f"{dataset} ({standard})")
        func(dataset, standard)

def read_parquet(table_name: str, *paths: Path) -> nw.LazyFrame[duckdb.DuckDBPyRelation]:
    if len(paths) == 1:
        files_sql = f"'{paths[0]}'"
    else:
        files_sql = "[" + ", ".join(f"'{p}'" for p in paths) + "]"
    con.sql(f"CREATE OR REPLACE VIEW {table_name} AS SELECT * FROM read_parquet({files_sql});")
    return to_narwhals(con.view(table_name))

import boto3

bucket = boto3.resource('s3', endpoint_url='https://a3s.fi').Bucket('dhh26')

groups: dict[str, list] = {}

for file in filter(lambda obj: obj.key.endswith('.parquet'), bucket.objects.filter(Prefix='books/')):
    table_name = re.sub(r"_\d+$", "", re.sub(".*/", "", file.key.removesuffix('.parquet')))
    groups.setdefault(table_name, []).append("s3://" + bucket.name + "/" + file.key)

for table_name, files in (pbar := tqdm(groups.items())):
    pbar.set_description(f"Registering {table_name}")
    globals()[table_name] = read_parquet(table_name, *files)
    #print(f"{table_name} = cast(nw.LazyFrame[DuckDBPyRelation], None)")

__all__ = ['nw', 'f', 'c', 'l', 'con', 'bnf', 'cerl_thesaurus', 'cnb', 'dbnf', 'dnb', 'erb', 'e_id', 'fennica', 'foo', 'geonames', 'geonames_alternate_names', 'gnd', 'hpb', 'idloc', 'isni_authority_ids', 'isni_core', 'isni_deprecated_isnis', 'isni_names', 'isni_same_as', 'isni_source_ids', 'istc', 'kbnl', 'kbse', 'melinda', 'natdk', 'natno', 'plnb', 'ptnb', 'p_cataloguing_date', 'p_country_of_publication', 'p_last_modification_datetime', 'p_primary_language', 'p_title', 'p_year_of_publication', 'stcv', 'tgn', 'ulan', 'vd17', 'vd18', 'viaf', 'wd_aliases', 'wd_claim_globecoordinate', 'wd_claim_monolingualtext', 'wd_claim_no_value', 'wd_claim_quantity', 'wd_claim_some_value', 'wd_claim_string', 'wd_claim_time', 'wd_claim_wikibase_entityid', 'wd_datatypes', 'wd_descriptions', 'wd_entities', 'wd_labels', 'wd_qualifier_globecoordinate', 'wd_qualifier_monolingualtext', 'wd_qualifier_no_value', 'wd_qualifier_quantity', 'wd_qualifier_some_value', 'wd_qualifier_string', 'wd_qualifier_time', 'wd_qualifier_wikibase_entityid','wd_reference_globecoordinate','wd_reference_monolingualtext','wd_reference_no_value','wd_reference_quantity','wd_reference_some_value','wd_reference_string','wd_reference_time','wd_reference_wikibase_entityid','wd_sitelinks','wd_sitelink_badges', 'duckdb', 'to_narwhals', 'to_duckdb', 'format_sql', 'to_parquet', 'iter_datasets']
