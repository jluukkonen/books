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
    
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            # 1. Fetch Censor Occurrences
            print("Fetching censor approvals...")
            censor_query = """
                SELECT 
                    record_number,
                    COALESCE(
                        MAX(CASE WHEN subfield_code = 'a' THEN value END),
                        MAX(CASE WHEN subfield_code = 'P' THEN value END)
                    ) as censor_surname,
                    MAX(CASE WHEN subfield_code = 'd' THEN value END) as censor_firstname,
                    MAX(CASE WHEN subfield_code = '7' THEN value END) as gnd_val
                FROM books.vd17
                WHERE field_code = '028C'
                GROUP BY record_number, field_number
                HAVING MAX(CASE WHEN subfield_code = 'B' THEN value END) IN ('Zensor', 'ZensorIn')
            """
            cur.execute(censor_query)
            censors_df = pl.from_arrow(cur.fetch_arrow_table())
            print(f"Retrieved {len(censors_df)} censor approvals.")
            
            # 2. Fetch Years for Vetted Books
            print("Fetching years for vetted books...")
            years_query = """
                SELECT record_number, value as year_val
                FROM books.vd17
                WHERE field_code = '011@' AND subfield_code = 'a'
                  AND record_number IN (
                      SELECT DISTINCT record_number
                      FROM books.vd17
                      WHERE field_code = '028C' AND subfield_code = 'B' AND value IN ('Zensor', 'ZensorIn')
                  )
            """
            cur.execute(years_query)
            years_df = pl.from_arrow(cur.fetch_arrow_table())
            print(f"Retrieved {len(years_df)} year records.")
            
            # 3. Fetch Publishers for Vetted Books
            print("Fetching publishers for vetted books...")
            pub_query = """
                SELECT record_number, value as publisher_name
                FROM books.vd17
                WHERE field_code = '033A' AND subfield_code = 'n'
                  AND record_number IN (
                      SELECT DISTINCT record_number
                      FROM books.vd17
                      WHERE field_code = '028C' AND subfield_code = 'B' AND value IN ('Zensor', 'ZensorIn')
                  )
            """
            cur.execute(pub_query)
            pubs_df = pl.from_arrow(cur.fetch_arrow_table())
            print(f"Retrieved {len(pubs_df)} publisher records.")
            
    print("Joining datasets in memory using Polars...")
    # Join censors with years and publishers
    # Clean up publisher names
    pubs_df = pubs_df.with_columns(pl.col("publisher_name").str.strip_chars())
    
    # Perform joins
    joined_df = censors_df.join(years_df, on="record_number", how="inner")
    joined_df = joined_df.join(pubs_df, on="record_number", how="inner")
    print(f"Joined dataset has {len(joined_df)} rows.")
    
    # Initialize timeline arrays (30 decades from 1500 to 1790)
    timelines = {node_id: [0]*30 for node_id in node_ids}
    
    matched_censors = 0
    matched_publishers = 0
    
    for row in joined_df.iter_rows(named=True):
        c_surname = row["censor_surname"]
        c_firstname = row["censor_firstname"]
        gnd_val = row["gnd_val"]
        p_name = row["publisher_name"]
        year_str = row["year_val"]
        
        # Parse year
        try:
            year = int(year_str)
        except ValueError:
            continue
            
        if year < 1500 or year >= 1800:
            continue
            
        decade_idx = (year - 1500) // 10
        
        # Resolve Censor Name
        c_name = ""
        if c_surname:
            c_name = f"{c_surname.strip()}, {c_firstname.strip()}" if c_firstname else c_surname.strip()
        else:
            c_name = "[Unknown]"
            
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
                
        # Add to timelines
        if display_name in timelines:
            timelines[display_name][decade_idx] += 1
            matched_censors += 1
            
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
