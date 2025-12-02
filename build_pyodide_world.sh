#!/usr/bin/env bash
set -euo pipefail

# Rebuild a Pyodide runtime + packages from pyodide-recipes,
# limiting the packaged world to the dependency closure of the
# core stack we actually need in the browser.
#
# Usage:
#   ./build_pyodide_world.sh
# or override:
#   PYODIDE_RECIPES_TARGETS='numpy,scipy,...' ./build_pyodide_world.sh
#
# This script clones/updates pyodide-recipes into _pyodide-recipes/,
# builds recipes into _pyodide-recipes/repodata, copies in the Pyodide
# runtime, then replaces this repo's pyodide/ directory with that output.

THIS_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_PYODIDE_DIR="${THIS_REPO_ROOT}/static/pyodide"

PYODIDE_RECIPES_DIR="${PYODIDE_RECIPES_DIR:-${THIS_REPO_ROOT}/_pyodide-recipes}"
CUSTOM_RECIPES_DIR="${THIS_REPO_ROOT}/pyodide-custom-recipes"
PYODIDE_ENV_NAME="${PYODIDE_ENV_NAME:-pyodide-env}"

# By default we only ask pyodide-build to build the packages needed for
# the sc2ts / tskit stack:
#   - tskit and its dependencies (including msprime and sc2ts)
#   - the numerical / plotting stack: numpy, scipy, pandas, matplotlib, bokeh
#   - pysam for BAM/CRAM handling
#   - numcodecs for tszip's compression backend
#   - zarr + tszip + sc2ts + humanize so we can read/write and analyse .tsz files without micropip
#   - core Pyodide helpers: micropip, pyodide-http, pyodide-unix-timezones
#
# pyodide-build will compute the full transitive dependency closure of
# these roots. Additional packages (or a full world) can still be built
# by overriding PYODIDE_RECIPES_TARGETS in the environment, e.g.:
#   PYODIDE_RECIPES_TARGETS='*' ./build_pyodide_world.sh
PYODIDE_RECIPES_TARGETS="${PYODIDE_RECIPES_TARGETS:-micropip,pyodide-http,pyodide-unix-timezones,tskit,msprime,sc2ts,numpy,scipy,pandas,matplotlib,bokeh,pysam,numcodecs,zarr,humanize,tszip}"

echo "=== Pyodide world rebuild ==="
echo "Repo root           : ${THIS_REPO_ROOT}"
echo "Target pyodide dir  : ${TARGET_PYODIDE_DIR}"
echo "pyodide-recipes dir : ${PYODIDE_RECIPES_DIR}"
echo "Conda env name      : ${PYODIDE_ENV_NAME}"
echo "Recipe targets      : ${PYODIDE_RECIPES_TARGETS}"
echo

if ! command -v conda >/dev/null 2>&1; then
  echo "ERROR: conda is not on PATH. Please install Miniconda/Conda first." >&2
  exit 1
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "ERROR: rustup is not on PATH. Install Rust (rustup) first, for example:" >&2
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y" >&2
  echo "then restart your shell so that \$HOME/.cargo/bin is on PATH." >&2
  exit 1
fi

mkdir -p "${PYODIDE_RECIPES_DIR}"

if [ ! -d "${PYODIDE_RECIPES_DIR}/.git" ]; then
  echo "Cloning pyodide-recipes into ${PYODIDE_RECIPES_DIR} ..."
  git clone --recursive https://github.com/pyodide/pyodide-recipes.git "${PYODIDE_RECIPES_DIR}"
else
  echo "Updating existing pyodide-recipes clone in ${PYODIDE_RECIPES_DIR} ..."
  git -C "${PYODIDE_RECIPES_DIR}" fetch --all --prune
  git -C "${PYODIDE_RECIPES_DIR}" checkout main
  git -C "${PYODIDE_RECIPES_DIR}" pull --ff-only
  git -C "${PYODIDE_RECIPES_DIR}" submodule update --init --recursive
fi

echo
echo "=== Applying custom recipe overrides (if any) ==="
if [ -d "${CUSTOM_RECIPES_DIR}" ]; then
  for pkg_dir in "${CUSTOM_RECIPES_DIR}"/*; do
    [ -d "${pkg_dir}" ] || continue
    pkg_name="$(basename "${pkg_dir}")"
    echo "  - Overlaying recipe for ${pkg_name}"
    mkdir -p "${PYODIDE_RECIPES_DIR}/packages/${pkg_name}"
    cp -a "${pkg_dir}/." "${PYODIDE_RECIPES_DIR}/packages/${pkg_name}/"
  done
else
  echo "  (No custom recipes found in ${CUSTOM_RECIPES_DIR})"
fi

cd "${PYODIDE_RECIPES_DIR}"

if [ ! -f environment.yml ]; then
  echo "ERROR: environment.yml not found in ${PYODIDE_RECIPES_DIR}" >&2
  exit 1
fi

echo
echo "=== Ensuring conda environment ${PYODIDE_ENV_NAME} ==="

if ! conda env list | awk '{print $1}' | grep -qx "${PYODIDE_ENV_NAME}"; then
  echo "Creating conda env ${PYODIDE_ENV_NAME} from environment.yml ..."
  conda env create -n "${PYODIDE_ENV_NAME}" -f environment.yml
else
  echo "Updating existing conda env ${PYODIDE_ENV_NAME} from environment.yml ..."
  conda env update -n "${PYODIDE_ENV_NAME}" -f environment.yml
fi

echo
echo "=== Activating conda environment ==="
eval "$(conda shell.bash hook)"
conda activate "${PYODIDE_ENV_NAME}"

echo
echo "=== Installing pyodide-build and cross build environment ==="
python -m pip install ./pyodide-build/
pyodide xbuildenv install

echo
echo "=== Installing and configuring Emscripten SDK ==="
python tools/install_and_patch_emscripten.py

echo
echo "=== Building recipes: ${PYODIDE_RECIPES_TARGETS} ==="
export PIP_CONSTRAINT="$(pwd)/tools/constraints.txt"
export _EMCC_CACHE=1

if [ -d emsdk ]; then
  # shellcheck disable=SC1091
  source emsdk/emsdk_env.sh
fi

mkdir -p repodata build-logs

pyodide build-recipes "${PYODIDE_RECIPES_TARGETS}" --install --install-dir=./repodata --log-dir=build-logs

echo
echo "=== Copying Pyodide runtime into repodata ==="
./tools/copy_pyodide_runtime.sh ./repodata

echo
echo "=== Installing new world into ${TARGET_PYODIDE_DIR} ==="
rm -rf "${TARGET_PYODIDE_DIR}"
mkdir -p "${TARGET_PYODIDE_DIR}"
cp -a repodata/. "${TARGET_PYODIDE_DIR}/"

echo
echo "=== Pruning unused wheels from ${TARGET_PYODIDE_DIR} ==="
PYODIDE_DIR="${TARGET_PYODIDE_DIR}" python - << 'PY'
import json
import os
import sys

pyodide_dir = os.environ.get("PYODIDE_DIR")
if not pyodide_dir:
    raise SystemExit("PYODIDE_DIR is not set")

lock_path = os.path.join(pyodide_dir, "pyodide-lock.json")
if not os.path.exists(lock_path):
    print(f"No pyodide-lock.json in {pyodide_dir}, skipping prune", file=sys.stderr)
    raise SystemExit(0)

with open(lock_path, "r", encoding="utf-8") as f:
    data = json.load(f)

packages = data.get("packages", {})
keep_names = {pkg.get("file_name") for pkg in packages.values() if pkg.get("file_name")}

# Always keep the core runtime artifacts and the lock file itself.
keep_names.update(
    {
        "pyodide.js",
        "pyodide.mjs",
        "pyodide.asm.js",
        "pyodide.asm.wasm",
        "python_stdlib.zip",
        "pyodide-lock.json",
    }
)

removed = 0
for entry in os.listdir(pyodide_dir):
    if entry in keep_names:
        continue
    path = os.path.join(pyodide_dir, entry)
    if os.path.isfile(path):
        os.remove(path)
        removed += 1

print(f"Pruned {removed} unused files from {pyodide_dir}")
PY

echo
echo "Done. The pyodide/ directory now holds the rebuilt world."
echo "Rebuild the site with:"
echo "  cd \"${THIS_REPO_ROOT}\""
echo "  ./build.sh"
