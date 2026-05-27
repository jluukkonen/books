from collections import defaultdict
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
import polars as pl

with here("db_secret.yaml").open('r') as yaml_file:
    db_params = yaml.safe_load(yaml_file)

con: dbapi.Connection = dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"]))
#with con.cursor() as cur:
#    cur.execute_update(f"CREATE SECRET ( TYPE s3, KEY_ID '{db_params['aws_access_key_id']}', SECRET '{db_params['aws_secret_access_key']}', ENDPOINT 'a3s.fi' );")
#    cur.execute_update("SET enable_progress_bar=true;")
from sqlframe_gizmosql import GizmoSQLSession, GizmoSQLDataFrame
import sqlframe_gizmosql.functions as F

# Create a session connected to GizmoSQL
s: GizmoSQLSession = GizmoSQLSession.builder \
    .config("gizmosql.uri", db_params["uri"]) \
    .config("gizmosql.username", db_params["username"]) \
    .config("gizmosql.password", db_params["password"]) \
    .getOrCreate()

c = nw.col
l = nw.lit

def to_narwhals(gizmosql_table: GizmoSQLDataFrame) -> nw.LazyFrame[GizmoSQLDataFrame]:
    return nw.from_native(gizmosql_table)

def to_gizmosql(narwhals_frame: nw.LazyFrame[GizmoSQLDataFrame]) -> GizmoSQLDataFrame:
    return narwhals_frame.to_native()

def format_sql(query: str, read:str = 'duckdb', write:str = 'duckb') -> str:
    return sqlglot.transpile(query, read=read, write=write, pretty=True)[0]

def persist_as_s3_parquet(table_name: str, source: str, lnf: nw.LazyFrame[GizmoSQLDataFrame]):
    with con.cursor() as cur:
        cur.execute_update(f"COPY ({to_gizmosql(lnf).sql(dialect='duckdb', pretty=False, optimize=False)}) TO 's3://dhh26/books/{table_name}/source={source}' (FORMAT parquet, COMPRESSION zstd, OVERWRITE_OR_IGNORE, FILE_SIZE_BYTES 2_000_000_000, FILENAME_PATTERN '{table_name}_{source}_{{i}}');")
#        cur.execute_update(f"CREATE OR REPLACE VIEW books.{table_name} AS SELECT * FROM read_parquet('s3://dhh26/books/{table_name}/*/*.parquet', hive_partitioning=true);")
    
def register_s3_parquets_as_view(table_name: str) -> nw.LazyFrame[GizmoSQLDataFrame]:
    with con.cursor() as cur:
        cur.execute_update(f"CREATE OR REPLACE VIEW books.{table_name} AS SELECT * FROM read_parquet('s3://dhh26/books/{table_name}/*/*.parquet', hive_partitioning=true);")
    return f(table_name)

datasets = dict[str, nw.LazyFrame[GizmoSQLDataFrame]]()

def f(dataset: str) -> nw.LazyFrame[GizmoSQLDataFrame]:
    if dataset not in datasets:
        datasets[dataset] = nw.from_native(s.table(f'books.{dataset}'))
    return datasets[dataset]

def dataset_exists(dataset: str) -> bool:
    if dataset in datasets:
        return True
    return dataset in list_datasets()

def list_datasets() -> list[str]:
    return [table.name for table in s.catalog.listTables("books")]

def iter_catalogues(func: Callable[[str, str], None]):
    for row in (pbar := tqdm(list(f('collection_info').filter(c('dataset_type') == 'catalogue').collect(backend='polars').iter_rows(named=True)))):
        dataset = row['dataset']
        standard = row['standard']
        pbar.set_description(f"{dataset} ({standard})")
        if dataset_exists(dataset):
            func(dataset, standard)

def p(lnf: nw.LazyFrame[GizmoSQLDataFrame]) -> pl.DataFrame:
    return lnf.collect(backend='polars').to_native()

__all__ = ['nw', 'p', 'pl', 'F', 'f', 'dataset_exists', 'list_datasets', 'c', 'l', 'con', 's', 'GizmoSQLDataFrame', 'to_narwhals', 'to_gizmosql', 'format_sql', 'persist_as_s3_parquet', 'iter_catalogues', 'register_s3_parquets_as_view']
