import json
import os
from pathlib import Path

import nbformat
from nbclient import NotebookClient


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PYODIDE_LOCK = DIST / "static" / "pyodide" / "pyodide-lock.json"
JUPYTER_LITE_CONFIG = DIST / "jupyter-lite.json"


def test_pyodide_world_contains_expected_packages():
  """Sanity-check that the custom Pyodide world includes key packages."""
  data = json.loads(PYODIDE_LOCK.read_text(encoding="utf8"))
  packages = data["packages"]
  for name in ["tskit", "numpy", "scipy", "pandas", "msprime", "pysam", "zarr", "humanize", "tszip", "sc2ts"]:
    assert name in packages, f"{name} missing from pyodide-lock.json"


def test_pyodide_module_runtime_artifacts_are_present():
  pyodide_dir = PYODIDE_LOCK.parent
  for name in [
    "pyodide.mjs",
    "pyodide.asm.mjs",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json",
  ]:
    assert (pyodide_dir / name).exists(), f"{name} missing from Pyodide runtime"


def test_pyodide_lock_package_files_are_present():
  pyodide_dir = PYODIDE_LOCK.parent
  data = json.loads(PYODIDE_LOCK.read_text(encoding="utf8"))
  for package in data["packages"].values():
    file_name = package.get("file_name")
    if file_name is not None:
      assert (pyodide_dir / file_name).exists(), f"{file_name} missing from Pyodide runtime"


def test_configured_pyodide_module_exists():
  config = json.loads(JUPYTER_LITE_CONFIG.read_text(encoding="utf8"))
  settings = config["jupyter-config-data"]["litePluginSettings"][
    "@jupyterlite/pyodide-kernel-extension:kernel"
  ]
  pyodide_url = settings["pyodideUrl"]
  assert pyodide_url.endswith(".mjs")
  assert (DIST / pyodide_url.removeprefix("./")).exists()


def _execute_notebook(notebook_path: Path, *, cells: int | None = None, timeout: int = 600) -> None:
  """Execute a notebook using the local CPython kernel.

  If `cells` is provided, only the first `cells` code cells are executed.
  """
  nb = nbformat.read(notebook_path, as_version=4)
  for cell in nb.cells:
    if cell.cell_type == "code":
      cell.source = cell.source.replace('"/drive/', f'"{notebook_path.parent}/')
      cell.source = cell.source.replace(
        "from pyodide.http import pyfetch",
        "from pathlib import Path",
      )
      cell.source = cell.source.replace(
        'response = await pyfetch("/files/data/demo.trees")\n'
        "ts = tskit.load(io.BytesIO(await response.bytes()))",
        'ts = tskit.load(Path("data/demo.trees"))',
      )

  if cells is not None:
    code_cells = [c for c in nb.cells if c.cell_type == "code"]
    if code_cells:
      nb.cells = code_cells[:cells]

  cwd = os.getcwd()
  try:
    os.chdir(notebook_path.parent)
    client = NotebookClient(nb, timeout=timeout, kernel_name="python3")
    client.execute()
  finally:
    os.chdir(cwd)


def test_tskit_notebook_executes():
  _execute_notebook(ROOT / "content" / "tskit.ipynb")


def test_sc2ts_notebook_imports_and_loads():
  # Run just the first code cell, which imports tszip/sc2ts and loads the ARG.
  _execute_notebook(ROOT / "content" / "sc2ts.ipynb", cells=1, timeout=900)
