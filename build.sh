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
worker_type_patched_files = []
for path in kernel_extension_dir.glob("*.js"):
    source = path.read_text()
    patched = load_pyodide_pattern.sub(r"(await import(\2)).loadPyodide", source)
    patched = patched.replace("{type:void 0}", '{type:"module"}')
    if patched != source:
        path.write_text(patched)
        patched_files.append(path.name)
    if "{type:void 0}" in source and '{type:"module"}' in patched:
        worker_type_patched_files.append(path.name)

if not patched_files:
    raise SystemExit("No Pyodide dynamic import bundle entry was patched")
if not worker_type_patched_files:
    raise SystemExit("No Pyodide worker type entry was patched")
PY
python3 - <<'PY'
import hashlib
from pathlib import Path

paths = []
for root in [
    Path("content"),
    Path("pyodide-custom-recipes"),
    Path("repl"),
    Path("tskit-launcher/src"),
    Path("tskit-launcher/style"),
]:
    if root.exists():
        paths.extend(path for path in root.rglob("*") if path.is_file())

for path in [
    Path("build.sh"),
    Path("build_pyodide_world.sh"),
    Path("jupyter-lite.json"),
    Path("requirements.txt"),
    Path("tskit-launcher/package.json"),
    Path("tskit-launcher/package-lock.json"),
    Path("dist/jupyter-lite.json"),
    Path("dist/static/pyodide/pyodide-lock.json"),
    Path("dist/static/pyodide/pyodide.asm.mjs"),
    Path("dist/static/pyodide/pyodide.asm.wasm"),
    Path("dist/static/pyodide/python_stdlib.zip"),
]:
    if path.exists():
        paths.append(path)

pyodide_dir = Path("dist/static/pyodide")
if pyodide_dir.exists():
    paths.extend(pyodide_dir.glob("pyodide*.mjs"))

digest = hashlib.sha256()
for path in sorted(set(paths)):
    digest.update(path.as_posix().encode())
    digest.update(b"\0")
    digest.update(path.read_bytes())
    digest.update(b"\0")

Path("content-hash.txt").write_text(digest.hexdigest() + "\n")
PY
HASH=$(cat content-hash.txt)
echo "{\"contentHash\":\"$HASH\",\"lastUpdated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/lab/content-config.json
