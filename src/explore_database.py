import sys
from pathlib import Path
import narwhals as nw

# Add project root to sys.path so we can import src.common_basis
import hereutil
project_root = hereutil.here()
hereutil.add_to_sys_path(project_root)

print("Connecting to the GizmoSQL remote database...")
try:
    from src.common_basis import *
    print("Successfully connected to the remote database!")
except Exception as e:
    print(f"Error connecting to database: {e}")
    sys.exit(1)

# Now we can query!
print("\n--- Available Database Tables (Narwhals LazyFrames) ---")
# Get active tables in the session
try:
    tables = s.catalog.listTables("books")
    print(f"Total tables found in 'books' catalog: {len(tables)}")
    print("First 25 tables:")
    for table in list(tables)[:25]:
        print(f"  - books.{table.name}")
    if len(tables) > 25:
        print(f"  ... and {len(tables) - 25} more.")
except Exception as e:
    print(f"Error listing tables: {e}")

print("\n--- Quick Statistics: Total Publications by Year ---")
# Show count of books per year from 1450 to 1800
try:
    year_stats = (
        p_year_of_publication
        .filter((c("year_of_publication") >= 1450) & (c("year_of_publication") <= 1800))
        .group_by(c("year_of_publication"))
        .agg(nw.len().alias("count"))
        .sort('year_of_publication', descending=False)
        .collect(backend='polars')
    )
    
    # Group by decade for display
    decades = (
        year_stats
        .with_columns(((c("year_of_publication") // 10) * 10).alias("decade"))
        .group_by(c("decade"))
        .agg(c("count").sum().alias("decade_count"))
        .sort("decade")
    )
    print("Decade-level publication counts (1450-1800):")
    print(decades.collect(backend='polars') if hasattr(decades, 'collect') else decades)
except Exception as e:
    print(f"Error querying year statistics: {e}")

print("\n--- Querying 'p_title' Schema & Search ---")
# Let's inspect the fields/columns of the p_title table and run a query
try:
    print(f"Schema of 'p_title': {p_title.schema if hasattr(p_title, 'schema') else 'LazyFrame'}")
    
    # We will search for 'nature' or 'evolution' or 'intelligence' related keywords in p_title
    keywords = ["nature", "evolution", "intelligence", "natur", "evolut", "intellig"]
    pattern = "(?i)" + "|".join(keywords)
    print(f"Searching titles for pattern: '{pattern}'")
    
    hits = (
        p_title
        .filter(c("title").str.contains(pattern))
        .limit(10)
        .collect(backend='polars')
    )
    print("\nSample hits matching target concepts in p_title:")
    print(hits)
except Exception as e:
    print(f"Error running search query on p_title: {e}")

print("\nExploration completed!")
