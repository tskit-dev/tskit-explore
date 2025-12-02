#!/usr/bin/env bash
set -euo pipefail

# Remove large, reproducible build artifacts so that a fresh,
# trimmed Pyodide world and JupyterLite site can be generated.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Cleaning build artifacts under ${ROOT_DIR}"

# JupyterLite build output
if [ -d "${ROOT_DIR}/dist" ]; then
  echo "  - Removing dist/"
  rm -rf "${ROOT_DIR}/dist"
fi

# Pyodide runtime + wheels copied from pyodide-recipes
if [ -d "${ROOT_DIR}/pyodide" ]; then
  echo "  - Removing pyodide/"
  rm -rf "${ROOT_DIR}/pyodide"
fi

# pyodide-recipes local build outputs (can always be regenerated)
if [ -d "${ROOT_DIR}/_pyodide-recipes/repodata" ]; then
  echo "  - Removing _pyodide-recipes/repodata/ (best effort)"
  rm -rf "${ROOT_DIR}/_pyodide-recipes/repodata" || echo "      (could not remove repodata; check permissions)"
fi

if [ -d "${ROOT_DIR}/_pyodide-recipes/build-logs" ]; then
  echo "  - Removing _pyodide-recipes/build-logs/ (best effort)"
  rm -rf "${ROOT_DIR}/_pyodide-recipes/build-logs" || echo "      (could not remove build-logs; check permissions)"
fi

# Any locally built Pyodide wheels sitting at the repo root (e.g. tskit)
TSKIT_WHEEL_PATTERN="${ROOT_DIR}/tskit-"*"pyodide_2025_0_wasm32.whl"
shopt -s nullglob
TSKIT_WHEELS=( ${TSKIT_WHEEL_PATTERN} )
shopt -u nullglob
if [ "${#TSKIT_WHEELS[@]}" -gt 0 ]; then
  echo "  - Removing local Pyodide tskit wheels:"
  for w in "${TSKIT_WHEELS[@]}"; do
    echo "      * ${w##${ROOT_DIR}/}"
    rm -f "${w}"
  done
fi

echo "Done. You can now run:"
echo "  ./build_pyodide_world.sh"
echo "  ./build.sh"
