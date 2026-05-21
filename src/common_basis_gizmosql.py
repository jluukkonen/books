import os
from typing import Callable, cast
import duckdb
import narwhals as nw
#from adbc_driver_flightsql import dbapi
from adbc_driver_gizmosql import dbapi
from hereutil import here
import sqlglot
import yaml
from tqdm.auto import tqdm

with here("db_secret.yaml").open('r') as yaml_file:
    db_params = yaml.safe_load(yaml_file)

con: dbapi.Connection = dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"]))

from sqlframe_gizmosql import GizmoSQLSession, GizmoSQLDataFrame
import sqlframe_gizmosql.functions as F

# Create a session connected to GizmoSQL
s: GizmoSQLSession = GizmoSQLSession.builder \
    .config("gizmosql.uri", db_params["uri"]) \
    .config("gizmosql.username", db_params["username"]) \
    .config("gizmosql.password", db_params["password"]) \
    .getOrCreate()

bnf = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
cerl_thesaurus = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
cnb = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
dbnf = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
dnb = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
erb = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
e_id = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
fennica = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
foo = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
geonames = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
geonames_alternate_names = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
gnd = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
hpb = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
idloc = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
isni_authority_ids = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
isni_core = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
isni_deprecated_isnis = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
isni_names = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
isni_same_as = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
isni_source_ids = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
istc = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
kbnl = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
kbse = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
melinda = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
natdk = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
natno = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
plnb = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
ptnb = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
p_cataloguing_date = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
p_country_of_publication = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
p_last_modification_datetime = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
p_primary_language = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
p_title = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
p_year_of_publication = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
stcv = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
tgn = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
ulan = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
vd17 = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
vd18 = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
viaf = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_aliases = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_globecoordinate = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_monolingualtext = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_no_value = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_quantity = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_some_value = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_string = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_time = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_claim_wikibase_entityid = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_datatypes = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_descriptions = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_entities = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_labels = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_globecoordinate = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_monolingualtext = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_no_value = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_quantity = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_some_value = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_string = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_time = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_qualifier_wikibase_entityid = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_globecoordinate = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_monolingualtext = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_no_value = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_quantity = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_some_value = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_string = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_time = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_reference_wikibase_entityid = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_sitelinks = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
wd_sitelink_badges = cast(nw.LazyFrame[GizmoSQLDataFrame], None)
collection_info = cast(nw.LazyFrame[GizmoSQLDataFrame], None)

for table in (pbar := tqdm(s.catalog.listTables("books"))):
    pbar.set_description(f"Registering {table.name}")
    #print(f"{table.name} = cast(nw.LazyFrame[GizmoSQLDataFrame], None)")
    try:
        globals()[table.name] = nw.from_native(s.table(f"{cast(list[str], table.namespace)[0]}.{table.name}"))
    except Exception as e:
        # geonames_alternate_names bugs due to having a 'from' column. SQLFrame seems to lack some escaping..
        pass

c = nw.col
l = nw.lit

def to_narwhals(gizmosql_table: GizmoSQLDataFrame) -> nw.LazyFrame[GizmoSQLDataFrame]:
    return nw.from_native(gizmosql_table)

def to_gizmosql(narwhals_frame: nw.LazyFrame[GizmoSQLDataFrame]) -> GizmoSQLDataFrame:
    return narwhals_frame.to_native()

def format_sql(query: str, read:str = 'duckdb', write:str = 'duckb') -> str:
    return sqlglot.transpile(query, read=read, write=write, pretty=True)[0]

def to_parquet(table_name: str, lnf: nw.LazyFrame[GizmoSQLDataFrame]) -> nw.LazyFrame[GizmoSQLDataFrame]:
    with con.cursor() as cur:
        cur.execute_update(f"COPY ({to_gizmosql(lnf).sql(dialect='duckdb', pretty=True, optimize=True)}) TO 's3://dhh26/books/{table_name}.parquet' (FORMAT 'parquet', COMPRESSION 'ZSTD')")
        cur.execute_update(f"CREATE OR REPLACE VIEW books.{table_name} AS SELECT * FROM read_parquet('s3://dhh26/books/{table_name}.parquet')")
    return nw.from_native(s.table(f'books.{table_name}'))    

def f(dataset: str) -> nw.LazyFrame[GizmoSQLDataFrame]:
    return cast(nw.LazyFrame[GizmoSQLDataFrame], globals()[dataset] if dataset in globals() else None) 

def iter_datasets(func: Callable[[str, str], None]):
    for row in (pbar := tqdm(list(collection_info.collect(backend='polars').iter_rows(named=True)))):
        dataset = row['dataset']
        standard = row['standard']
        pbar.set_description(f"{dataset} ({standard})")
        func(dataset, standard)

__all__ = ['nw', 'F', 'f', 'c', 'l', 'con', 's', 'bnf', 'cerl_thesaurus', 'cnb', 'dbnf', 'dnb', 'erb', 'e_id', 'fennica', 'foo', 'geonames', 'geonames_alternate_names', 'gnd', 'hpb', 'idloc', 'isni_authority_ids', 'isni_core', 'isni_deprecated_isnis', 'isni_names', 'isni_same_as', 'isni_source_ids', 'istc', 'kbnl', 'kbse', 'melinda', 'natdk', 'natno', 'plnb', 'ptnb', 'p_cataloguing_date', 'p_country_of_publication', 'p_last_modification_datetime', 'p_primary_language', 'p_title', 'p_year_of_publication', 'stcv', 'tgn', 'ulan', 'vd17', 'vd18', 'viaf', 'wd_aliases', 'wd_claim_globecoordinate', 'wd_claim_monolingualtext', 'wd_claim_no_value', 'wd_claim_quantity', 'wd_claim_some_value', 'wd_claim_string', 'wd_claim_time', 'wd_claim_wikibase_entityid', 'wd_datatypes', 'wd_descriptions', 'wd_entities', 'wd_labels', 'wd_qualifier_globecoordinate', 'wd_qualifier_monolingualtext', 'wd_qualifier_no_value', 'wd_qualifier_quantity', 'wd_qualifier_some_value', 'wd_qualifier_string', 'wd_qualifier_time', 'wd_qualifier_wikibase_entityid','wd_reference_globecoordinate','wd_reference_monolingualtext','wd_reference_no_value','wd_reference_quantity','wd_reference_some_value','wd_reference_string','wd_reference_time','wd_reference_wikibase_entityid','wd_sitelinks','wd_sitelink_badges', 'GizmoSQLDataFrame', 'to_narwhals', 'to_gizmosql', 'format_sql', 'to_parquet', 'iter_datasets']
