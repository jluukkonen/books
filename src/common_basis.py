from typing import cast
import narwhals as nw

from adbc_driver_flightsql import dbapi
from hereutil import here
import yaml

with here("db_secret.yaml").open('r') as f:
    db_params = yaml.safe_load(f)

con: dbapi.Connection = dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"]))

from sqlframe_gizmosql import GizmoSQLSession, GizmoSQLTable
import sqlframe_gizmosql.functions as F

# Create a session connected to GizmoSQL
s: GizmoSQLSession = GizmoSQLSession.builder \
    .config("gizmosql.uri", db_params["uri"]) \
    .config("gizmosql.username", db_params["username"]) \
    .config("gizmosql.password", db_params["password"]) \
    .getOrCreate()

bnf = cast(nw.LazyFrame[GizmoSQLTable], None)
cerl_thesaurus = cast(nw.LazyFrame[GizmoSQLTable], None)
cnb = cast(nw.LazyFrame[GizmoSQLTable], None)
dbnf = cast(nw.LazyFrame[GizmoSQLTable], None)
dnb = cast(nw.LazyFrame[GizmoSQLTable], None)
erb = cast(nw.LazyFrame[GizmoSQLTable], None)
e_id = cast(nw.LazyFrame[GizmoSQLTable], None)
fennica = cast(nw.LazyFrame[GizmoSQLTable], None)
foo = cast(nw.LazyFrame[GizmoSQLTable], None)
geonames = cast(nw.LazyFrame[GizmoSQLTable], None)
geonames_alternate_names = cast(nw.LazyFrame[GizmoSQLTable], None)
gnd = cast(nw.LazyFrame[GizmoSQLTable], None)
hpb = cast(nw.LazyFrame[GizmoSQLTable], None)
idloc = cast(nw.LazyFrame[GizmoSQLTable], None)
isni_authority_ids = cast(nw.LazyFrame[GizmoSQLTable], None)
isni_core = cast(nw.LazyFrame[GizmoSQLTable], None)
isni_deprecated_isnis = cast(nw.LazyFrame[GizmoSQLTable], None)
isni_names = cast(nw.LazyFrame[GizmoSQLTable], None)
isni_same_as = cast(nw.LazyFrame[GizmoSQLTable], None)
isni_source_ids = cast(nw.LazyFrame[GizmoSQLTable], None)
istc = cast(nw.LazyFrame[GizmoSQLTable], None)
kbnl = cast(nw.LazyFrame[GizmoSQLTable], None)
kbse = cast(nw.LazyFrame[GizmoSQLTable], None)
melinda = cast(nw.LazyFrame[GizmoSQLTable], None)
natdk = cast(nw.LazyFrame[GizmoSQLTable], None)
natno = cast(nw.LazyFrame[GizmoSQLTable], None)
plnb = cast(nw.LazyFrame[GizmoSQLTable], None)
ptnb = cast(nw.LazyFrame[GizmoSQLTable], None)
p_cataloguing_date = cast(nw.LazyFrame[GizmoSQLTable], None)
p_country_of_publication = cast(nw.LazyFrame[GizmoSQLTable], None)
p_last_modification_datetime = cast(nw.LazyFrame[GizmoSQLTable], None)
p_primary_language = cast(nw.LazyFrame[GizmoSQLTable], None)
p_title = cast(nw.LazyFrame[GizmoSQLTable], None)
p_year_of_publication = cast(nw.LazyFrame[GizmoSQLTable], None)
stcv = cast(nw.LazyFrame[GizmoSQLTable], None)
tgn = cast(nw.LazyFrame[GizmoSQLTable], None)
ulan = cast(nw.LazyFrame[GizmoSQLTable], None)
vd17 = cast(nw.LazyFrame[GizmoSQLTable], None)
vd18 = cast(nw.LazyFrame[GizmoSQLTable], None)
viaf = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_aliases = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_globecoordinate = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_monolingualtext = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_no_value = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_quantity = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_some_value = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_string = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_time = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_claim_wikibase_entityid = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_datatypes = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_descriptions = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_entities = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_labels = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_globecoordinate = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_monolingualtext = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_no_value = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_quantity = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_some_value = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_string = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_time = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_qualifier_wikibase_entityid = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_globecoordinate = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_monolingualtext = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_no_value = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_quantity = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_some_value = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_string = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_time = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_reference_wikibase_entityid = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_sitelinks = cast(nw.LazyFrame[GizmoSQLTable], None)
wd_sitelink_badges = cast(nw.LazyFrame[GizmoSQLTable], None)

for table in s.catalog.listTables("books"):
    #print(f"{table.name} = cast(nw.LazyFrame[GizmoSQLTable], None)")
    try:
        globals()[table.name] = nw.from_native(s.table(f"{cast(list[str], table.namespace)[0]}.{table.name}"))
    except Exception as e:
        # geonames_alternate_names bugs due to having a 'from' column. SQLFrame seems to lack some escaping..
        pass

c = nw.col
l = nw.lit

__all__ = ['nw', 'F', 'c', 'l', 'con', 's', 'bnf', 'cerl_thesaurus', 'cnb', 'dbnf', 'dnb', 'erb', 'e_id', 'fennica', 'foo', 'geonames', 'geonames_alternate_names', 'gnd', 'hpb', 'idloc', 'isni_authority_ids', 'isni_core', 'isni_deprecated_isnis', 'isni_names', 'isni_same_as', 'isni_source_ids', 'istc', 'kbnl', 'kbse', 'melinda', 'natdk', 'natno', 'plnb', 'ptnb', 'p_cataloguing_date', 'p_country_of_publication', 'p_last_modification_datetime', 'p_primary_language', 'p_title', 'p_year_of_publication', 'stcv', 'tgn', 'ulan', 'vd17', 'vd18', 'viaf', 'wd_aliases', 'wd_claim_globecoordinate', 'wd_claim_monolingualtext', 'wd_claim_no_value', 'wd_claim_quantity', 'wd_claim_some_value', 'wd_claim_string', 'wd_claim_time', 'wd_claim_wikibase_entityid', 'wd_datatypes', 'wd_descriptions', 'wd_entities', 'wd_labels', 'wd_qualifier_globecoordinate', 'wd_qualifier_monolingualtext', 'wd_qualifier_no_value', 'wd_qualifier_quantity', 'wd_qualifier_some_value', 'wd_qualifier_string', 'wd_qualifier_time', 'wd_qualifier_wikibase_entityid','wd_reference_globecoordinate','wd_reference_monolingualtext','wd_reference_no_value','wd_reference_quantity','wd_reference_some_value','wd_reference_string','wd_reference_time','wd_reference_wikibase_entityid','wd_sitelinks','wd_sitelink_badges']
