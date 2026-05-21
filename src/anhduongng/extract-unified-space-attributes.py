#%%
from hereutil import here, add_to_sys_path
add_to_sys_path(here())
from src.common_basis_gizmosql import *

subqueries: list[nw.LazyFrame] = []

#%%

#%%
def extract_publisher(dataset: str, standard: str):
    if standard in {'marc21', 'danmarc'} and dataset not in {'dnb', 'kbse', 'gnd', 'viaf'} and f(dataset) is not None:
       q =  (globals()[dataset]
            .filter(c('field_code') == '260', c('subfield_code') == 'b')
       )

    elif standard == 'marc21' and dataset in {'dnb', 'kbse'}:
        q =  (globals()[dataset]
            .filter(c('field_code') == '264', c('subfield_code') == 'b')
       )
        # potentially in
        # dnb 770$d
        # kbse 810$b 599$a 856$3
    
    elif standard == 'marc21' and dataset == 'viaf':
        q =  (globals()[dataset]
            .filter(c('field_code') == '921', c('subfield_code') == 'a')
       )
        
    elif standard == 'marc21' and dataset == 'gnd':
        q =  (globals()[dataset]
            .filter(c('field_code') == '913', c('subfield_code') == 'a')
       )
        
    elif standard == 'intermarc':
        q =  (globals()[dataset]
            .filter(c('field_code') == '260', c('subfield_code') == 'c')
       )

    elif standard == 'unimarc':
        q =  (globals()[dataset]
            .filter(c('field_code') == '210', c('subfield_code') == 'c')
       )
        
    elif standard == 'pica' and f(dataset) is not None:
        q =  (globals()[dataset]
            .filter(c('field_code') == '033A', c('subfield_code') == 'n')
       )
        
    elif standard == 'istc':
         q = (
             globals()[dataset]
                .filter(c('subfield_code') == 'imprint_name')
         )
    
    else:
        print(f"Skipping publisher extraction for dataset {dataset} with standard {standard}")
        return
    subqueries.append(q
                        .join(e_id.filter(c('source') == dataset), left_on='record_number', right_on='i_id')
                        .select(c('e_id'), c('value').alias('publisher_name')))

subqueries.clear()
iter_datasets(extract_publisher)

to_parquet("p_publisher_name", nw.concat(subqueries).sort('e_id'))
