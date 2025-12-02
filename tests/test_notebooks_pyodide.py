import json
import os
from pathlib import Path

import nbformat
from nbclient import NotebookClient


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PYODIDE_LOCK = DIST / "static" / "pyodide" / "pyodide-lock.json"


def test_pyodide_world_contains_expected_packages():
  """Sanity-check that the custom Pyodide world includes key packages."""
  data = json.loads(PYODIDE_LOCK.read_text(encoding="utf8"))
  packages = data["packages"]
  for name in ["tskit", "numpy", "scipy", "pandas", "msprime", "pysam", "zarr", "humanize", "tszip", "sc2ts"]:
    assert name in packages, f"{name} missing from pyodide-lock.json"


def _execute_notebook(notebook_path: Path, *, cells: int | None = None, timeout: int = 600) -> None:
  """Execute a notebook using the local CPython kernel.

  If `cells` is provided, only the first `cells` code cells are executed.
  """
  nb = nbformat.read(notebook_path, as_version=4)

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
