import yaml
from adbc_driver_flightsql import dbapi
import polars as pl
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

OUT = "/Volumes/United/DHH26/German_Censorship_Focus"
SCRATCH = f"{OUT}/scratch"

plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Helvetica']
plt.rcParams['grid.alpha'] = 0.3

def query_networks():
    with open('/Volumes/United/DHH26/books-main/db_secret.yaml', 'r') as f:
        db_params = yaml.safe_load(f)
    
    print("Connecting to database...")
    with dbapi.connect(db_params["uri"], db_kwargs=dict(username=db_params["username"], password=db_params["password"])) as con:
        with con.cursor() as cur:
            
            all_networks = {}
            
            for city_filter, city_label in [
                ("LOWER(place.value) LIKE 'leipzig%'", "Leipzig"),
                ("(LOWER(place.value) LIKE 'frankfurt%' AND LOWER(place.value) NOT LIKE '%oder%')", "Frankfurt"),
            ]:
                for decade, year_start, year_end in [
                    (1610, 1610, 1619),
                    (1650, 1650, 1659),
                    (1690, 1690, 1700),
                ]:
                    key = f"{city_label}_{decade}s"
                    print(f"\nQuerying network for {key}...")
                    
                    # Author surname: 028A/A (217k records)
                    # Publisher name: 033A/n (303k records)
                    # Place: 033D/p (normalized)
                    query = f"""
                        SELECT 
                            TRIM(author.value) as author_name,
                            TRIM(pub.value) as publisher_name,
                            COUNT(DISTINCT e.e_id) as weight
                        FROM books.vd17 author
                        JOIN books.vd17 pub ON author.record_number = pub.record_number
                        JOIN books.vd17 place ON author.record_number = place.record_number
                        JOIN books.e_id e ON e.i_id = author.record_number AND e.source = 'vd17'
                        JOIN books.p_year_of_publication y ON e.e_id = y.e_id
                        WHERE 
                            author.field_code = '028A' AND author.subfield_code = 'A'
                            AND pub.field_code = '033A' AND pub.subfield_code = 'n'
                            AND place.field_code = '033D' AND place.subfield_code = 'p'
                            AND {city_filter}
                            AND y.year_of_publication >= {year_start} AND y.year_of_publication <= {year_end}
                            AND TRIM(author.value) != '' AND TRIM(pub.value) != ''
                        GROUP BY author_name, publisher_name
                        ORDER BY weight DESC
                    """
                    cur.execute(query)
                    net_df = pl.from_arrow(cur.fetch_arrow_table())
                    all_networks[key] = net_df
                    
                    if len(net_df) > 0:
                        net_df.write_csv(f"{SCRATCH}/network_{key}.csv")
                        unique_authors = net_df["author_name"].n_unique()
                        unique_pubs = net_df["publisher_name"].n_unique()
                        total_weight = net_df["weight"].sum()
                        print(f"  {unique_authors} authors, {unique_pubs} publishers, {len(net_df)} links, {total_weight} total publications")
                        print(f"  Top 5 links:")
                        print(net_df.head(5))
                    else:
                        print(f"  No links found")
            
            # Build comparison summary
            summary_data = []
            for key, net_df in all_networks.items():
                parts = key.split("_")
                city = parts[0]
                decade = parts[1]
                unique_authors = net_df["author_name"].n_unique() if len(net_df) > 0 else 0
                unique_pubs = net_df["publisher_name"].n_unique() if len(net_df) > 0 else 0
                total_links = len(net_df)
                total_weight = net_df["weight"].sum() if len(net_df) > 0 else 0
                density = total_links / (unique_authors * unique_pubs) if (unique_authors * unique_pubs) > 0 else 0
                # Average publications per author
                avg_pubs_per_author = total_weight / unique_authors if unique_authors > 0 else 0
                
                summary_data.append({
                    "city": city,
                    "decade": decade,
                    "unique_authors": unique_authors,
                    "unique_publishers": unique_pubs,
                    "unique_links": total_links,
                    "total_publications": total_weight,
                    "density": round(density, 4),
                    "avg_pubs_per_author": round(avg_pubs_per_author, 2)
                })
            
            summary = pl.DataFrame(summary_data)
            summary.write_csv(f"{SCRATCH}/network_comparison.csv")
            print("\n=== Network Comparison Summary ===")
            print(summary)
            
            # Plot: grouped bar comparison
            fig, axes = plt.subplots(2, 2, figsize=(14, 10))
            
            metrics = [
                ("unique_authors", "Unique Authors", axes[0, 0]),
                ("unique_publishers", "Unique Publishers/Printers", axes[0, 1]),
                ("unique_links", "Unique Author–Publisher Links", axes[1, 0]),
                ("density", "Network Density", axes[1, 1]),
            ]
            
            decades_list = sorted(set(d["decade"] for d in summary_data))
            x = range(len(decades_list))
            width = 0.35
            
            for metric, title, ax in metrics:
                leipzig_vals = []
                frankfurt_vals = []
                for dec in decades_list:
                    l_rows = [d for d in summary_data if d["city"] == "Leipzig" and d["decade"] == dec]
                    f_rows = [d for d in summary_data if d["city"] == "Frankfurt" and d["decade"] == dec]
                    leipzig_vals.append(l_rows[0][metric] if l_rows else 0)
                    frankfurt_vals.append(f_rows[0][metric] if f_rows else 0)
                
                ax.bar([j - width/2 for j in x], leipzig_vals, width, label='Leipzig', color='#2b5c8f', alpha=0.85)
                ax.bar([j + width/2 for j in x], frankfurt_vals, width, label='Frankfurt', color='#e26d5c', alpha=0.85)
                ax.set_title(title, weight='bold', fontsize=12)
                ax.set_xticks(list(x))
                ax.set_xticklabels(decades_list, fontsize=10)
                ax.legend(fontsize=9, frameon=True, facecolor='white')
                
                # Add value labels on bars
                for j, (lv, fv) in enumerate(zip(leipzig_vals, frankfurt_vals)):
                    if lv > 0:
                        ax.text(j - width/2, lv + max(leipzig_vals + frankfurt_vals) * 0.02,
                                str(int(lv)) if isinstance(lv, (int, float)) and lv == int(lv) else f"{lv:.3f}",
                                ha='center', fontsize=8, color='#2b5c8f')
                    if fv > 0:
                        ax.text(j + width/2, fv + max(leipzig_vals + frankfurt_vals) * 0.02,
                                str(int(fv)) if isinstance(fv, (int, float)) and fv == int(fv) else f"{fv:.3f}",
                                ha='center', fontsize=8, color='#e26d5c')
            
            fig.suptitle("Author–Publisher Networks: Leipzig vs. Frankfurt (1610s–1690s)",
                         fontsize=15, weight='bold', y=1.02)
            plt.tight_layout()
            plt.savefig(f"{OUT}/network_comparison.png", dpi=300, bbox_inches='tight')
            plt.close()
            print("Saved network_comparison.png")

if __name__ == '__main__':
    query_networks()
