/**
 * Built-in Docling integration: convert documents (URL or file path) to markdown
 * by running the Python script backend/scripts/docling_convert.py.
 * Requires: DOCLING_ENABLED=1, Python 3.10+, and pip install docling.
 */

import { spawn } from 'child_process';
import { config } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');

function getPythonPath(): string {
  const p = config.doclingPythonPath;
  if (!p) return 'python3';
  if (path.isAbsolute(p)) return p;
  if (p.startsWith('.') || p.includes('.venv') || p.includes('venv')) {
    return path.resolve(backendDir, p);
  }
  return p;
}

export function isDoclingAvailable(): boolean {
  return config.doclingEnabled === true;
}

/**
 * Convert a document (URL or absolute file path) to markdown using Docling.
 * @param urlOrPath - HTTP/HTTPS URL or absolute path to a file (PDF, DOCX, PPTX, HTML, etc.)
 * @returns Markdown string
 * @throws Error if Docling is disabled, script fails, or conversion fails
 */
export function convertToMarkdown(urlOrPath: string): Promise<string> {
  if (!config.doclingEnabled) {
    return Promise.reject(new Error('Docling is not enabled. Set DOCLING_ENABLED=1 and install docling (pip install docling).'));
  }
  const trimmed = urlOrPath?.trim();
  if (!trimmed) {
    return Promise.reject(new Error('url_or_path is required'));
  }
  const scriptPath = path.resolve(backendDir, 'scripts', 'docling_convert.py');
  const pythonPath = getPythonPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, [scriptPath, trimmed], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (err) => {
      reject(new Error(`Failed to run Docling (${pythonPath}): ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout || '');
      } else {
        reject(new Error(stderr?.trim() || `Docling exited with code ${code}`));
      }
    });
  });
}
