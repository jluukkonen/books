import json

with open("data/network.json", "r") as f:
    data = json.load(f)

nodes = data.get("nodes", [])
links = data.get("links", [])

print(f"Total nodes: {len(nodes)}")
print(f"Total links: {len(links)}")

censor_nodes = [n for n in nodes if n.get("type") == "censor"]
publisher_nodes = [n for n in nodes if n.get("type") == "publisher"]

print(f"Censors: {len(censor_nodes)}")
print(f"Publishers: {len(publisher_nodes)}")

print("\nSample Censor Node:")
if censor_nodes:
    print(json.dumps(censor_nodes[0], indent=2))

print("\nSample Publisher Node:")
if publisher_nodes:
    print(json.dumps(publisher_nodes[0], indent=2))

print("\nSample Link:")
if links:
    print(json.dumps(links[0], indent=2))
