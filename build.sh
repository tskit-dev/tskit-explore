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
python3 - <<'PY'
import hashlib
import json
import re
import shutil
from pathlib import Path

config_path = Path("dist/jupyter-lite.json")
config = json.loads(config_path.read_text())
pyodide_dir = Path("dist/static/pyodide")
pyodide_module = pyodide_dir / "pyodide.mjs"
module_hash = hashlib.sha256(pyodide_module.read_bytes()).hexdigest()[:12]
versioned_module = pyodide_dir / f"pyodide-{module_hash}.mjs"
shutil.copy2(pyodide_module, versioned_module)

kernel_settings = config["jupyter-config-data"]["litePluginSettings"][
    "@jupyterlite/pyodide-kernel-extension:kernel"
]
kernel_settings["pyodideUrl"] = f"./static/pyodide/{versioned_module.name}"
config_path.write_text(json.dumps(config, indent=2) + "\n")

kernel_extension_dir = Path(
    "dist/extensions/@jupyterlite/pyodide-kernel-extension/static"
)
load_pyodide_pattern = re.compile(
    r"\(await ([A-Za-z_$][\w$]*|__webpack_require__)\(476\)\(([A-Za-z_$][\w$]*)\)\)\.loadPyodide"
)
patched_files = []
for path in kernel_extension_dir.glob("*.js"):
    source = path.read_text()
    patched = load_pyodide_pattern.sub(r"(await import(\2)).loadPyodide", source)
    if patched != source:
        path.write_text(patched)
        patched_files.append(path.name)

if not patched_files:
    raise SystemExit("No Pyodide dynamic import bundle entry was patched")
PY
find content/ -type f -exec cat {} \; | sha256sum | cut -d' ' -f1 > content-hash.txt
HASH=$(cat content-hash.txt)
echo "{\"contentHash\":\"$HASH\",\"lastUpdated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/lab/content-config.json
