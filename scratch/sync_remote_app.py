import os

def main():
    app_path = '/Volumes/United/DHH26/books-main/app.js'
    remote_app_path = '/Volumes/United/DHH26/books-main/remote_app.js'
    
    if not os.path.exists(app_path):
        print(f"Error: {app_path} not found")
        return
        
    with open(app_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace the cache-busting fetch lines with clean versions
    content = content.replace("await fetch('data/network.json?v=' + Date.now());", "await fetch('data/network.json');")
    content = content.replace("await fetch('data/timeline.csv?v=' + Date.now());", "await fetch('data/timeline.csv');")
    content = content.replace("await fetch('data/censor_timelines.json?v=' + Date.now());", "await fetch('data/censor_timelines.json');")
    
    with open(remote_app_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("remote_app.js successfully synchronized and formatted!")

if __name__ == '__main__':
    main()
