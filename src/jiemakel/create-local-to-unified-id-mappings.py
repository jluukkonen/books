#%%
from hereutil import here, add_to_sys_path
add_to_sys_path(here())

from src.common_basis_gizmosql import *

#%%

with con.cursor() as cur:
    cur.execute("DROP TABLE IF EXISTS e_id_tmp;")
    cur.execute("CREATE OR REPLACE TEMPORARY SEQUENCE e_id_seq START 1;")
    cur.execute("CREATE OR REPLACE TEMPORARY TABLE e_id_tmp (e_id BIGINT NOT NULL DEFAULT nextval('e_id_seq'), i_id BIGINT DEFAULT NULL, s_id STRING DEFAULT NULL, source STRING NOT NULL);")

#e_id_tmp = to_narwhals(s.table("e_id_tmp"))

def map_ids(dataset: str, standard: str):
    if dataset == "wikidata":
        with con.cursor() as cur:
            cur.execute_update("INSERT INTO e_id_tmp (i_id, source) SELECT entity_id, 'wikidata' FROM books.wd_entities;")
    elif dataset == "isni":
        with con.cursor() as cur:
            cur.execute_update("INSERT INTO e_id_tmp (i_id, source) SELECT isni_n, 'isni' FROM books.isni_core;")
    elif dataset == "geonames":
        with con.cursor() as cur:
            cur.execute_update("INSERT INTO e_id_tmp (i_id, source) SELECT geonameid, 'geonames' FROM books.geonames;")
    elif standard == "rdf":
#        spo = tqdm(total=3, leave=False)
#        spo.set_description("p")
#        con.sql(f"INSERT INTO books.e_id_tmp (s_id, source) SELECT DISTINCT property, 'iri' FROM {dataset} ANTI JOIN books.e_id_tmp ON (property = s_id);")
#        spo.update(1)
#        spo.set_description("o")
#        con.sql(f"INSERT INTO books.e_id_tmp (s_id, source) SELECT DISTINCT object, 'iri' FROM {dataset} ANTI JOIN books.e_id_tmp ON (object = s_id) WHERE datatype_lang='xs:anyURI';")
#        spo.update(1)
#        spo.set_description("s")
        with con.cursor() as cur:
            cur.execute_update(f"INSERT INTO e_id_tmp (s_id, source) SELECT DISTINCT subject, 'iri' FROM books.{dataset} ANTI JOIN e_id_tmp ON (subject = s_id);")
#        spo.update(1)
#        spo.close()
    elif f(dataset) is None:
        print(f"Dataset {dataset} not found, skipping.")
    elif standard in {"intermarc", "marc21", "unimarc", "pica", "istc", "danmarc", 'ctmarc'}:
        with con.cursor() as cur:
            cur.execute_update(f"INSERT INTO e_id_tmp (i_id, source) SELECT DISTINCT record_number, '{dataset}' FROM books.{dataset};")
    else:
        raise ValueError(f"Unknown dataset standard {standard} for dataset {dataset}")

iter_datasets(map_ids)

#%%
with con.cursor() as cur:
    cur.execute_update("COPY (SELECT * FROM e_id_tmp) TO 's3://dhh26/books/e_id' (FORMAT parquet, OVERWRITE_OR_IGNORE, COMPRESSION zstd, COMPRESSION_LEVEL 22, FILENAME_PATTERN='e_id_{i}', FILE_SIZE_BYTES 2_000_000_000);")
    cur.execute_update("CREATE OR REPLACE VIEW books.e_id AS SELECT * FROM read_parquet('s3://dhh26/books/e_id/e_id_*.parquet')")
    cur.execute_update("DROP TABLE e_id_tmp;")
    cur.execute_update("DROP SEQUENCE e_id_seq;")
#for file in sorted(glob.glob(str(here("data/unified/.e_id_tmp/data_*.parquet")))):
#    m = cast(re.Match, re.search(r'data_(\d+)\.parquet$', file))
#    suffix = "" if m.group(1) == "0" else f"_{m.group(1)}"
#    shutil.move(file, here(f"data/unified/e_id{suffix}.parquet"))
#os.rmdir(here("data/unified/.e_id_tmp"))
#e_id_files = sorted(here("data/unified").glob("e_id*.parquet"))
#e_id = read_parquet("e_id", *e_id_files)
# %%
