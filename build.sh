#!/bin/bash -e
python3 fix_jupyterlite_html.py content
cd tskit-launcher/
# Install JS dependencies and build the labextension without relying on jlpm.
npm install

npx tsc --sourceMap
jupyter labextension build --development True .
pip install -e .
cd ..
rm -rf dist 
jupyter lite build --contents content --output-dir dist
find content/ -type f -exec cat {} \; | sha256sum | cut -d' ' -f1 > content-hash.txt
HASH=$(cat content-hash.txt)
echo "{\"contentHash\":\"$HASH\",\"lastUpdated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/lab/content-config.json
