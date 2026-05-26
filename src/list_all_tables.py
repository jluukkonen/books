import sys
from pathlib import Path

# Add project root to sys.path so we can import src.common_basis
import hereutil
project_root = hereutil.here()
hereutil.add_to_sys_path(project_root)

print("Connecting to remote database...")
try:
    from src.common_basis import *
    print("Successfully connected!")
except Exception as e:
    print(f"Error connecting: {e}")
    sys.exit(1)

# Get all tables
tables = s.catalog.listTables("books")
table_names = [t.name for t in tables]
print(f"Total tables: {len(table_names)}")

# Look for any tables related to country, place, town, location, publisher, or author
target_keywords = ["place", "country", "town", "publ", "location", "author", "lang", "title", "year"]
matched_tables = []
for name in table_names:
    if any(kw in name.lower() for kw in target_keywords):
        matched_tables.append(name)
        
print("\nMatched Tables (of interest for metadata/entities):")
for name in sorted(matched_tables):
    print(f"  - books.{name}")
    
# Find any other tables starting with 'p_'
p_tables = [t for t in table_names if t.startswith("p_")]
print(f"\nAll entity properties tables ('p_...'):")
for t in sorted(p_tables):
    print(f"  - books.{t}")
    
print("\nInspecting schemas:")
for t in sorted(p_tables):
    try:
        tbl = s.table(f"books.{t}")
        print(f"Schema of books.{t}:")
        print(tbl.schema)
    except Exception as e:
        print(f"Could not inspect books.{t}: {e}")

