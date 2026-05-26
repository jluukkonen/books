import struct
import json
import os

glb_path = "assets/glb/medal_jonas_luukkonen.glb"

if not os.path.exists(glb_path):
    print(f"File not found: {glb_path}")
    exit(1)

with open(glb_path, "rb") as f:
    header = f.read(12)
    magic, version, length = struct.unpack("<4sII", header)
    print(f"Magic: {magic.decode('ascii')}, Version: {version}, Total Length: {length}")
    
    # Read chunk 0 (JSON)
    chunk_header = f.read(8)
    chunk_length, chunk_type = struct.unpack("<II", chunk_header)
    chunk_type_str = struct.pack("<I", chunk_type).decode('ascii', errors='ignore')
    print(f"Chunk 0 Length: {chunk_length}, Type: {chunk_type_str}")
    
    json_data = f.read(chunk_length).decode('utf-8')
    gltf = json.loads(json_data)
    
    print("\nScenes:")
    for i, scene in enumerate(gltf.get("scenes", [])):
        print(f"  Scene {i}: nodes={scene.get('nodes')}")
        
    print("\nNodes:")
    for i, node in enumerate(gltf.get("nodes", [])):
        print(f"  Node {i}: name={node.get('name')}, translation={node.get('translation')}, rotation={node.get('rotation')}, scale={node.get('scale')}, mesh={node.get('mesh')}")

    print("\nMeshes:")
    for i, mesh in enumerate(gltf.get("meshes", [])):
        print(f"  Mesh {i}: name={mesh.get('name')}, primitives count={len(mesh.get('primitives', []))}")
        
    print("\nAccessors (first 5):")
    for i, accessor in enumerate(gltf.get("accessors", [])[:5]):
        print(f"  Accessor {i}: componentType={accessor.get('componentType')}, count={accessor.get('count')}, type={accessor.get('type')}, min={accessor.get('min')}, max={accessor.get('max')}")
