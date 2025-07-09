#!/bin/bash -e
python fix_jupyterlite_html.py content
cd tskit-launcher/
jlpm install
jlpm run build
pip install -e . 
cd ..
rm -rf dist 
jupyter lite build --contents content --output-dir dist
find content/ -type f -exec cat {} \; | sha256sum | cut -d' ' -f1 > content-hash.txt
HASH=$(cat content-hash.txt)
echo "{\"contentHash\":\"$HASH\",\"lastUpdated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/lab/content-config.json