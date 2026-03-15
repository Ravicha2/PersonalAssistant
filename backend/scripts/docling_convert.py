#!/usr/bin/env python3
"""
Convert a document (URL or local path) to markdown using Docling.
Usage: python docling_convert.py <url_or_path>
Prints markdown to stdout; errors to stderr, exit code 1 on failure.
Requires: pip install docling (or uvx docling)
"""
import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: docling_convert.py <url_or_path>", file=sys.stderr)
        sys.exit(1)
    source = sys.argv[1].strip()
    if not source:
        print("Empty url_or_path", file=sys.stderr)
        sys.exit(1)
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        print("Docling not installed. Run: pip install docling", file=sys.stderr)
        sys.exit(1)
    try:
        converter = DocumentConverter()
        result = converter.convert(source)
        markdown = result.document.export_to_markdown()
        if markdown is None:
            markdown = ""
        print(markdown)
    except Exception as e:
        print(f"Docling error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
