/**
 * Persist MCP server tool lists (name + description) per user after successful connect.
 * Stored in data/mcp-tool-manifests.json.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { config } from '../config.js';

const MANIFESTS_FILE = join(config.dataDir, 'mcp-tool-manifests.json');

type ToolEntry = { name: string; description?: string };
type ServerManifest = { tools: ToolEntry[] };
type Stored = Record<string, Record<string, ServerManifest>>;

async function ensureDir(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
}

async function readAll(): Promise<Stored> {
  try {
    const data = await readFile(MANIFESTS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(stored: Stored): Promise<void> {
  await ensureDir();
  await writeFile(MANIFESTS_FILE, JSON.stringify(stored, null, 2), 'utf-8');
}

export async function saveMcpToolManifest(
  userId: string,
  serverId: string,
  tools: Array<{ name: string; description?: string }>
): Promise<void> {
  const stored = await readAll();
  if (!stored[userId]) stored[userId] = {};
  stored[userId][serverId] = {
    tools: tools.map((t) => ({ name: t.name, description: t.description ?? '' })),
  };
  await writeAll(stored);
}

export async function getMcpToolManifests(userId: string): Promise<Record<string, ToolEntry[]>> {
  const stored = await readAll();
  const user = stored[userId];
  if (!user || typeof user !== 'object') return {};
  const out: Record<string, ToolEntry[]> = {};
  for (const [serverId, manifest] of Object.entries(user)) {
    if (manifest?.tools) out[serverId] = manifest.tools;
  }
  return out;
}
