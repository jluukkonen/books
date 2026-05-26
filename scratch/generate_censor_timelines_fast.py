import os
import json
import yaml
from adbc_driver_flightsql import dbapi
import polars as pl
import re

def clean_name(name):
    if not name:
        return ""
    name = name.lower().strip()
    name = name.replace("us", "").replace("ius", "").replace("is", "")
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def main():
    print("Loading network.json...")
    network_file = "data/network.json"
    with open(network_file, "r") as f:
        network_data = json.load(f)
    
    node_ids = {node["id"]: node for node in network_data["nodes"]}
    print(f"Loaded {len(node_ids)} nodes from network.json")
    
    # Load censor profiles for name resolution
    profiles_df = pl.read_csv("/Volumes/United/DHH26/German_Censorship_Focus/Censors/censor_profiles.csv")
    gnd_to_profile = {}
    name_to_gnd = {}
    clean_name_to_gnd = {}
    
    for row in profiles_df.iter_rows(named=True):
        gid = str(row["gnd_id"]) if row["gnd_id"] else ""
        cname = row["censor_name"] if row["censor_name"] else ""
        pname = row["preferred_name"] if row["preferred_name"] else ""
        is_jes = row["is_jesuit"]
        
        profile_data = {
            "gnd_id": gid,
            "preferred_name": pname,
            "books_censored": row["books_censored"],
            "is_jesuit": is_jes
        }
        
        if gid:
            gnd_to_profile[gid] = profile_data
        if cname and cname != "[Unknown Name]":
            if gid:
                name_to_gnd[cname] = gid
                clean_name_to_gnd[clean_name(cname)] = gid
        if pname:
            if gid:
                name_to_gnd[pname] = gid
                clean_name_to_gnd[clean_name(pname)] = gid

    # Load database credentials
    with open('db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    
    query = """
        SELECT 
            record_number,
            field_code,
            subfield_code,
            value
        FROM books.vd17
        WHERE record_number IN (
            SELECT DISTINCT record_number
            FROM books.vd17
            WHERE field_code = '028C' AND subfield_code = 'B' AND value IN ('Zensor', 'ZensorIn')
        )
        AND field_code IN ('028C', '011@', '033A')
    """
    
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            print("Executing database query...")
            cur.execute(query)
            df = pl.from_arrow(cur.fetch_arrow_table())
            
    print(f"Retrieved {len(df)} records from the database. Grouping by record_number in Python...")
    
    # Process the rows in Python
    # We group by record_number to reconstruct the censored books
    book_records = {}
    for row in df.iter_rows(named=True):
        rec_num = row["record_number"]
        if rec_num not in book_records:
            book_records[rec_num] = {
                "censors": [], # list of dicts with surname, firstname, gnd_val
                "publishers": [],
                "years": []
            }
            
        fc = row["field_code"]
        sc = row["subfield_code"]
        val = row["value"]
        
        if fc == '028C':
            # Censor info is spread across multiple subfields per field occurrence
            # To handle multiple censors on a book, we can check if it's a new field
            # Actually, let's keep it simple: we want to accumulate all surname/firstname/gnd/role 
            # for this book, and build the censors. We can group by record_number and reconstruct them.
            # Wait, since the fields are ordered, we can just save all subfields for the record 
            # and split them. Let's do a simple subfield collector.
            book_records[rec_num]["censors"].append((sc, val))
        elif fc == '033A' and sc == 'n':
            book_records[rec_num]["publishers"].append(val.strip())
        elif fc == '011@' and sc == 'a':
            book_records[rec_num]["years"].append(val)
            
    print(f"Processed {len(book_records)} unique books. Reconstructing actors and updating timelines...")
    
    # Initialize timeline arrays (30 decades from 1500 to 1790)
    timelines = {node_id: [0]*30 for node_id in node_ids}
    
    matched_censors = 0
    matched_publishers = 0
    
    for rec_num, data in book_records.items():
        # 1. Parse Year
        year = None
        for yr_str in data["years"]:
            try:
                year = int(yr_str)
                break # use the first valid year
            except ValueError:
                continue
                
        if year is None or year < 1500 or year >= 1800:
            continue
            
        decade_idx = (year - 1500) // 10
        
        # 2. Parse Censors
        # Censors subfields are list of (sc, val)
        # We need to group them by field occurrence or reconstruct them.
        # Since we just want censor name, let's split the subfields into individual censors
        # Each censor field contains a 'B' (Zensor) and 'a' (surname) and 'd' (firstname) and '7' (GND)
        censors_in_book = []
        current_censor = {}
        for sc, val in data["censors"]:
            if sc == 'B':
                if current_censor and current_censor.get('B') in ['Zensor', 'ZensorIn']:
                    censors_in_book.append(current_censor)
                current_censor = {'B': val}
            else:
                current_censor[sc] = val
        if current_censor and current_censor.get('B') in ['Zensor', 'ZensorIn']:
            censors_in_book.append(current_censor)
            
        # If no explicit 'B' is found but we have name fields, collect them
        if not censors_in_book and data["censors"]:
            # fallback if 'B' was missing in our list or ordered differently
            # let's just make a single censor out of all subfields
            temp = {}
            for sc, val in data["censors"]:
                temp[sc] = val
            censors_in_book.append(temp)
            
        # For each censor, resolve display name
        resolved_censors = []
        for c in censors_in_book:
            c_surname = c.get('a', '')
            c_firstname = c.get('d', '')
            c_fullname = c.get('P', '')
            gnd_val = c.get('7', '')
            
            c_name = ""
            if c_surname:
                c_name = f"{c_surname.strip()}, {c_firstname.strip()}" if c_firstname else c_surname.strip()
            elif c_fullname:
                c_name = c_fullname.strip()
            else:
                continue
                
            g_id = ""
            if gnd_val and gnd_val.startswith("gnd/"):
                g_id = gnd_val[4:]
                
            resolved_gnd = ""
            if g_id:
                resolved_gnd = g_id
            elif c_name in name_to_gnd:
                resolved_gnd = name_to_gnd[c_name]
            else:
                c_clean = clean_name(c_name)
                if c_clean in clean_name_to_gnd:
                    resolved_gnd = clean_name_to_gnd[c_clean]
                    
            display_name = c_name
            if resolved_gnd in gnd_to_profile:
                profile = gnd_to_profile[resolved_gnd]
                if profile["preferred_name"]:
                    display_name = profile["preferred_name"]
            else:
                if c_name in name_to_gnd:
                    gid = name_to_gnd[c_name]
                    if gid in gnd_to_profile:
                        if gnd_to_profile[gid]["preferred_name"]:
                            display_name = gnd_to_profile[gid]["preferred_name"]
                else:
                    c_clean = clean_name(c_name)
                    for row_p in profiles_df.iter_rows(named=True):
                        if clean_name(row_p["censor_name"]) == c_clean or clean_name(row_p["preferred_name"]) == c_clean:
                            if row_p["preferred_name"]:
                                display_name = row_p["preferred_name"]
                            break
                            
            if display_name == "[Unknown]" or not display_name:
                if resolved_gnd:
                    display_name = f"GND:{resolved_gnd}"
                else:
                    display_name = "[Unknown Censor]"
                    
            resolved_censors.append(display_name)
            
        # Update censor timelines
        for c_disp in set(resolved_censors): # deduplicate per book
            if c_disp in timelines:
                timelines[c_disp][decade_idx] += 1
                matched_censors += 1
                
        # Update publisher timelines
        for p_name in set(data["publishers"]): # deduplicate per book
            if p_name in timelines:
                timelines[p_name][decade_idx] += 1
                matched_publishers += 1
                
    print(f"Finished processing. Matched censors: {matched_censors}, Matched publishers: {matched_publishers}")
    
    # Save timelines JSON
    with open("data/censor_timelines.json", "w") as f:
        json.dump(timelines, f)
        
    print(f"Successfully saved data/censor_timelines.json with {len(timelines)} timelines!")

if __name__ == '__main__':
    main()
