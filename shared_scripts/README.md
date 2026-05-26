# Shared Data Query & Network Analysis Scripts

This folder contains the core Python scripts used to query the remote FlightSQL database and extract the datasets that power the Interactive Dashboard (Leaflet Map, D3 Network Graph, and Chart.js timelines).

---

## 📁 Script Overview

| Script Name | Purpose | Target Catalogs | Key Outputs |
| :--- | :--- | :--- | :--- |
| **[`get_confessional_timeline.py`](file:///Volumes/United/DHH26/books-main/shared_scripts/get_confessional_timeline.py)** | Extracts year, place, and language counts. Normalizes city names and classifies them by historical confession (Catholic, Protestant, Mixed). | VD17, VD18 | `timeline.csv` (used by map & sparkline charts) |
| **[`check_censor_roles_vd16_vd18.py`](file:///Volumes/United/DHH26/books-main/shared_scripts/check_censor_roles_vd16_vd18.py)** | Searches catalog contributor fields (`028C`) for records with the role descriptor "Zensor/Zensorin" and joins them with censor names. | VD16, VD17, VD18 | Lists of active censors and frequency tables |
| **[`query_networks_final.py`](file:///Volumes/United/DHH26/books-main/shared_scripts/query_networks_final.py)** | Queries author-publisher networks for Leipzig vs. Frankfurt during the 1610s, 1650s, and 1690s. | VD17 | `network_comparison.csv` and `network_comparison.png` |
| **[`network_exporter.py`](file:///Volumes/United/DHH26/books-main/shared_scripts/network_exporter.py)** | Command-line utility to pull bipartite author-publisher networks for any catalog catalog source and decade. | any (VD17, ISTC, Fennica, etc.) | Standardized Gephi/NetworkX Edge Lists (`.csv`) |
| **[`generate_baseline.py`](file:///Volumes/United/DHH26/books-main/shared_scripts/generate_baseline.py)** | Queries the overall baseline publication numbers grouped by year, country, and primary language. | All catalogs | `global_baseline.csv` |

---

## ⚙️ How to Run

### 1. Database Credentials
All scripts connect to the remote database using the connection details in **`db_secret.yaml`**. Make sure this file is present in the project root:
```yaml
uri: "your_database_connection_uri"
username: "your_username"
password: "your_password"
```

### 2. Dependencies
Ensure you have the required Python libraries installed:
```bash
pip install polars adbc-driver-flightsql pyyaml matplotlib
```

### 3. Exporter Example
To extract a new network edge-list using the CLI exporter:
```bash
python shared_scripts/network_exporter.py --source vd17 --decade 1680 --output data/vd17_1680s_network.csv
```
