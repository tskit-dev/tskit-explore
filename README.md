# JupyterLite Demo

[![lite-badge](https://jupyterlite.rtfd.io/en/latest/_static/badge.svg)](https://jupyterlite.github.io/demo)

JupyterLite deployed as a static site to GitHub Pages, for demo purposes.

## ✨ Try it in your browser ✨

➡️ **https://jupyterlite.github.io/demo**

![github-pages](https://user-images.githubusercontent.com/591645/120649478-18258400-c47d-11eb-80e5-185e52ff2702.gif)

## Requirements

JupyterLite is being tested against modern web browsers:

- Firefox 90+
- Chromium 89+

## Deploy your JupyterLite website on GitHub Pages

Check out the guide on the JupyterLite documentation: https://jupyterlite.readthedocs.io/en/latest/quickstart/deploy.html

## Further Information and Updates

For more info, keep an eye on the JupyterLite documentation:

- How-to Guides: https://jupyterlite.readthedocs.io/en/latest/howto/index.html
- Reference: https://jupyterlite.readthedocs.io/en/latest/reference/index.html

This template provides the Pyodide kernel (`jupyterlite-pyodide-kernel`), the JavaScript kernel (`jupyterlite-javascript-kernel`), and the p5 kernel (`jupyterlite-p5-kernel`), along with other
optional utilities and extensions to make the JupyterLite experience more enjoyable. See the
[`requirements.txt` file](requirements.txt) for a list of all the dependencies provided.

For a template based on the Xeus kernel, see the [`jupyterlite/xeus-python-demo` repository](https://github.com/jupyterlite/xeus-python-demo)

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

