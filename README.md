# Tskit-based Demo Notebooks in JupyterLite

This is the source repository for notebooks hosted at 

https://tskit.dev/explore/

Individual notebooks can be linked using their name, e.g.

https://tskit.dev/explore/lab/?path=tskit.ipynb

These notebooks run JupyterLite as a static site, with compiled versions of the lastest versions of tskit and msprime. They therefore provide pyodide access to the most recent released versions of these libraries. Notebooks can be used in any modern browser:

- How-to Guides: https://jupyterlite.readthedocs.io/en/latest/howto/index.html
- Reference: https://jupyterlite.readthedocs.io/en/latest/reference/index.html

## Generic information

This repo provides the Pyodide kernel (`jupyterlite-pyodide-kernel`), the JavaScript kernel (`jupyterlite-javascript-kernel`), and the p5 kernel (`jupyterlite-p5-kernel`), along with other
optional utilities and extensions to make the JupyterLite experience more enjoyable. 

## Rebuilding Pyodide and packages from `pyodide-recipes`

To rebuild a full Pyodide runtime plus all packages from the latest `pyodide-recipes`:

1. Ensure you have `conda` and `rustup` (`rustup` must be on `PATH`).
2. From the repo root, run:
   ```bash
   pyodide/build_world_from_recipes.sh
   ```
   This will:
   - create or update a `pyodide-env` conda environment based on `pyodide-recipes/environment.yml`
   - clone or update `pyodide-recipes` (by default into `_pyodide-recipes/`)
   - use `pyodide build-recipes` to build all recipes and generate a `pyodide-lock.json`
   - copy the resulting runtime, lock file, and wheels into this repo’s `pyodide/` directory
3. Rebuild the site:
   ```bash
   ./build.sh
   ```

Environment variables:

- `PYODIDE_RECIPES_DIR` – where to clone `pyodide-recipes` (default: `_pyodide-recipes` under the repo root).
- `PYODIDE_ENV_NAME` – conda env name (default: `pyodide-env`).
- `PYODIDE_RECIPES_TARGETS` – package selection string for `pyodide build-recipes` (default: `"*"` for all packages; e.g. `*,!imgui-bundle` to disable a problematic recipe).

