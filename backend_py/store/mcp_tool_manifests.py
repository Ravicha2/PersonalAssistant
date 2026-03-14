"""Persist MCP server tool lists (name + description) per user after successful connect."""

import json
from pathlib import Path

try:
    from config import DATA_DIR
except ImportError:
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"

MANIFESTS_FILE = Path(DATA_DIR) / "mcp-tool-manifests.json"


def _read_all() -> dict:
    if not MANIFESTS_FILE.exists():
        return {}
    try:
        with open(MANIFESTS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _write_all(stored: dict) -> None:
    MANIFESTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MANIFESTS_FILE, "w", encoding="utf-8") as f:
        json.dump(stored, f, indent=2)


def save_mcp_tool_manifest(user_id: str, server_id: str, tools: list[dict]) -> None:
    stored = _read_all()
    if user_id not in stored:
        stored[user_id] = {}
    stored[user_id][server_id] = {
        "tools": [{"name": t.get("name", ""), "description": t.get("description", "")} for t in tools],
    }
    _write_all(stored)


def get_mcp_tool_manifests(user_id: str) -> dict[str, list[dict]]:
    stored = _read_all()
    user = stored.get(user_id)
    if not user or not isinstance(user, dict):
        return {}
    return {
        sid: (m.get("tools") or [])
        for sid, m in user.items()
        if isinstance(m, dict) and "tools" in m
    }
