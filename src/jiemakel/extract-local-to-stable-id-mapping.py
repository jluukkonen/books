#%%
from hereutil import here, add_to_sys_path
add_to_sys_path(here())
from common_basis_gizmosql import *

#%%
all_stable_id_rows: list[nw.LazyFrame[GizmoSQLDataFrame]] = []

def extract_stable_ids(dataset: str, standard: str):
    def emit_rows(
        frame: nw.LazyFrame[GizmoSQLDataFrame],
        id_expr: nw.Expr,
        id_type: nw.Expr,
        id_extra_expr: nw.Expr | None = None,
    ):
        return frame.select(
            l(dataset).alias('dataset'),
            c('record_number').alias('record_number'),
            id_expr.alias('id'),
            id_type.alias('id_type'),
            (id_extra_expr if id_extra_expr is not None else l(None).cast(nw.String)).alias('id_extra'),
        )

    def extract_simple(
        source: nw.LazyFrame[GizmoSQLDataFrame],
        field_code: str,
        id_type: str,
        subfield_code: str | None = None,
    ):
        predicates = [c('field_code') == field_code]
        if subfield_code is not None:
            predicates.append(c('subfield_code') == subfield_code)
        return emit_rows(source.filter(*predicates), c('value'), l(id_type))

    def extract_joined(
        source: nw.LazyFrame[GizmoSQLDataFrame],
        left_field_code: str,
        left_subfield_code: str | None,
        right_subfield_code: str | None,
        id_type: str,
        right_field_code: str | None = None,
    ):
        left_predicates = [c('field_code') == left_field_code]
        if left_subfield_code is not None:
            left_predicates.append(c('subfield_code') == left_subfield_code)
        right_predicates = [c('field_code') == (right_field_code or left_field_code)]
        if right_subfield_code is not None:
            right_predicates.append(c('subfield_code') == right_subfield_code)
        joined = source.filter(*left_predicates).join(
            source.filter(*right_predicates),
            on=['record_number', 'field_number'],
            how='left',
        )
        return emit_rows(joined, c('value'), l(id_type), c('value_right'))

    dataset_rows: list[nw.LazyFrame[GizmoSQLDataFrame]] = []
    source = f(dataset)
    if standard == 'pica' and source is not None:
        dataset_rows.extend([
            extract_simple(source, '003@', 'ppn'),
            extract_simple(source, '003@', 'oclc_number', '0'),
            extract_simple(source, '004A', 'isbn', '0'),
            extract_simple(source, '005A', 'issn', '0'),
            extract_simple(source, '006A', 'lccn_number', '0'),
            extract_simple(source, '006Y', 'general_id'),
            extract_joined(source, '006X', '0', 'i', 'other_id'),
            extract_joined(source, '007G', '0', 'i', 'original_id'),
        ])
    elif standard == 'marc21' and source is not None:
        dataset_rows.extend([
            extract_joined(source, '001', None, None, 'control_number', right_field_code='003'),
            extract_joined(source, '024', 'a', '2', 'standard_recording_code'),
            extract_simple(source, '010', 'lccn_number', 'a'),
            extract_simple(source, '020', 'isbn', 'a'),
            extract_simple(source, '022', 'issn', 'a'),
            extract_joined(source, '015', 'a', '2', 'national_bibliography_number'),
            extract_joined(source, '016', 'a', '2', 'national_bibliographic_agency_control_number'),
            extract_simple(source, '035', 'system_control_number', 'a'),
        ])
    elif standard == 'intermarc' and source is not None:
        dataset_rows.extend([
            extract_simple(source, '001', 'record_identification_number'),
            extract_simple(source, '003', 'permanent_url'),
        ])

    if dataset == 'vd17':
        dataset_rows.append(extract_simple(vd17, '006W', 'vd17_id'))
    elif dataset == 'vd18':
        dataset_rows.append(extract_simple(vd18, '006M', 'vd18_id'))
    elif dataset == 'melinda':
        dataset_rows.append(extract_joined(melinda, 'SID', 'b', 'c', 'sid'))
    elif dataset == 'cerl_thesaurus':
        dataset_rows.append(extract_simple(cerl_thesaurus, '001', 'cerl_id'))
        dataset_rows.append(emit_rows(
            cerl_thesaurus.filter(c('field_code') == '956', c('subfield_code') == 'y')
            .select(c('record_number'), c('field_number'), c('value'))
            .join(
                cerl_thesaurus.filter(c('field_code') == '956', c('subfield_code') == '0')
                .select(c('record_number'), c('field_number'), c('value').alias('value_right')),
                on=['record_number', 'field_number'],
            )
            .join(
                cerl_thesaurus.filter(c('field_code') == '956', c('subfield_code') == 'n')
                .select(c('record_number'), c('field_number'), c('value').alias('value_right_1')),
                on=['record_number', 'field_number'],
            ),
            c('value'),
            c('value_right'), 
            c('value_right_1')           
        ))
    elif dataset == 'viaf':
        dataset_rows.append(emit_rows(viaf.filter(c('field_code')=="700", c('subfield_code')=='0'), c('value').str.split(')').list.get(1), l('heading_linking_entry'), c('value').str.split(')').list.get(0).str.slice(1)))
    elif dataset in {"wikidata", "isni", "geonames", "viaf", "estc", "gnd", "bnf", "cnb", "dnb", "erb", "hpb"} or standard == "rdf":
        pass
    elif standard not in {'pica', 'marc21', 'intermarc'}:
        print(f"Skipping stable id extraction for dataset {dataset} with standard {standard}")

    if dataset_rows:
        all_stable_id_rows.append(nw.concat(dataset_rows))

iter_catalogues(extract_stable_ids)

if all_stable_id_rows:
    persist_as_s3_parquet(
        'stable_ids',
        nw.concat(all_stable_id_rows),
    )

# %%
