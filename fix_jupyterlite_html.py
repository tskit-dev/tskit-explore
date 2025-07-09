#!/usr/bin/env python3
"""
Fix JupyterLite HTML comma issue by consolidating multi-line HTML outputs to single lines.

This script processes .ipynb files and fixes the issue where JupyterLite adds commas
to the beginning of each line in HTML output. It does this by converting multi-line
HTML strings in cell outputs to single-line strings.

Usage:
    python fix_jupyterlite_html.py [notebook_file_or_directory]
    
If no argument is provided, it will process all .ipynb files in the current directory.
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any


def fix_html_output(output: Dict[str, Any]) -> bool:
    """
    Fix HTML output by consolidating multi-line strings to single lines.
    
    Args:
        output: A notebook cell output dictionary
        
    Returns:
        bool: True if the output was modified, False otherwise
    """
    modified = False
    
    # Check if this is an HTML output
    if output.get("output_type") == "execute_result" or output.get("output_type") == "display_data":
        data = output.get("data", {})
        
        # Fix text/html output
        if "text/html" in data:
            html_content = data["text/html"]
            
            # If it's a list of strings (multi-line), join them
            if isinstance(html_content, list):
                # Join all lines into a single string
                single_line_html = "".join(html_content)
                data["text/html"] = single_line_html
                modified = True
                print(f"  Fixed HTML output: converted {len(html_content)} lines to single line")
            
            # If it's a single string with newlines, we could optionally process it too
            # but the main issue is with the list format
    
    return modified


def fix_notebook(notebook_path: Path) -> bool:
    """
    Fix a single notebook file.
    
    Args:
        notebook_path: Path to the notebook file
        
    Returns:
        bool: True if the notebook was modified, False otherwise
    """
    print(f"Processing: {notebook_path}")
    
    try:
        # Read the notebook
        with open(notebook_path, 'r', encoding='utf-8') as f:
            notebook = json.load(f)
        
        modified = False
        
        # Process each cell
        for cell_idx, cell in enumerate(notebook.get("cells", [])):
            # Check cell outputs
            for output_idx, output in enumerate(cell.get("outputs", [])):
                if fix_html_output(output):
                    modified = True
        
        # Write back if modified
        if modified:
            with open(notebook_path, 'w', encoding='utf-8') as f:
                json.dump(notebook, f, indent=1, ensure_ascii=False)
            print(f"  ✓ Fixed and saved: {notebook_path}")
            return True
        else:
            print(f"  No changes needed: {notebook_path}")
            return False
            
    except Exception as e:
        print(f"  ✗ Error processing {notebook_path}: {e}")
        return False


def find_notebooks(path: Path) -> List[Path]:
    """
    Find all .ipynb files in a directory or return the single file.
    
    Args:
        path: Path to search (file or directory)
        
    Returns:
        List of notebook file paths
    """
    if path.is_file():
        if path.suffix == '.ipynb':
            return [path]
        else:
            print(f"Warning: {path} is not a .ipynb file")
            return []
    
    elif path.is_dir():
        notebooks = list(path.rglob('*.ipynb'))
        # Filter out checkpoint files
        notebooks = [nb for nb in notebooks if '.ipynb_checkpoints' not in str(nb)]
        return notebooks
    
    else:
        print(f"Error: {path} does not exist")
        return []


def main():
    parser = argparse.ArgumentParser(
        description="Fix JupyterLite HTML comma issue in notebook files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python fix_jupyterlite_html.py                    # Fix all .ipynb files in current directory
    python fix_jupyterlite_html.py notebook.ipynb     # Fix a specific notebook
    python fix_jupyterlite_html.py content/           # Fix all notebooks in content/ directory
    python fix_jupyterlite_html.py --dry-run          # Show what would be changed without modifying files
        """
    )
    
    parser.add_argument(
        'path', 
        nargs='?', 
        default='.', 
        help='Path to notebook file or directory (default: current directory)'
    )
    
    parser.add_argument(
        '--dry-run', 
        action='store_true', 
        help='Show what would be changed without modifying files'
    )
    
    args = parser.parse_args()
    
    # Convert to Path object
    search_path = Path(args.path)
    
    # Find all notebooks
    notebooks = find_notebooks(search_path)
    
    if not notebooks:
        print("No notebook files found.")
        return 1
    
    print(f"Found {len(notebooks)} notebook(s) to process:")
    for nb in notebooks:
        print(f"  - {nb}")
    print()
    
    if args.dry_run:
        print("DRY RUN MODE - No files will be modified")
        print()
    
    # Process each notebook
    total_modified = 0
    for notebook_path in notebooks:
        if not args.dry_run:
            if fix_notebook(notebook_path):
                total_modified += 1
        else:
            # For dry run, just check if it would be modified
            try:
                with open(notebook_path, 'r', encoding='utf-8') as f:
                    notebook = json.load(f)
                
                would_modify = False
                for cell in notebook.get("cells", []):
                    for output in cell.get("outputs", []):
                        if output.get("output_type") in ["execute_result", "display_data"]:
                            data = output.get("data", {})
                            if "text/html" in data and isinstance(data["text/html"], list):
                                would_modify = True
                                break
                    if would_modify:
                        break
                
                if would_modify:
                    print(f"  Would fix: {notebook_path}")
                    total_modified += 1
                else:
                    print(f"  No changes needed: {notebook_path}")
                    
            except Exception as e:
                print(f"  Error checking {notebook_path}: {e}")
    
    print(f"\nSummary: {total_modified} notebook(s) {'would be' if args.dry_run else 'were'} modified")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
