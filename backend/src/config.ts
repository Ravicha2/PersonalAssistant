import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  backendApiKey: process.env.BACKEND_API_KEY ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  dataDir: process.env.DATA_DIR ?? './data',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  maxMessageLength: 32_000,
  maxContextChars: 200_000,
  maxTabs: 30,
  rateLimitRequestsPerMinute: 60,
  rateLimitConcurrentStreams: 10,
  claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514',
  claudeMaxTokens: 4096,
  maxToolTurns: 5,
  /** Built-in Google (per-user OAuth): for Connectors → Google so each user has their own account. Required for multi-user online. */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  /** For Google Workspace MCP only: use GOOGLE_OAUTH_CLIENT_ID if different from built-in. */
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '',
  /** Timezone for calendar events (built-in and MCP). */
  calendarTimezone: process.env.CALENDAR_TIMEZONE ?? 'Asia/Jakarta',
  /** Optional JSON array of external MCP servers. Each: { "id": "brave", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-brave-search"], "env": { "BRAVE_API_KEY": "..." } }. */
  mcpServersJson: process.env.MCP_SERVERS_JSON ?? '',
  /** Enable built-in Docling document parsing (PDF, DOCX, PPTX, HTML → markdown). Requires Python 3.10+ and `pip install docling`. */
  doclingEnabled: process.env.DOCLING_ENABLED === '1' || process.env.DOCLING_ENABLED === 'true',
  /** Python command to run the Docling conversion script (e.g. "python3", "python", or "uvx run docling" if using uv). */
  doclingPythonPath: process.env.DOCLING_PYTHON_PATH ?? 'python3',
} as const;

export type McpServerConfig = {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export function getMcpServersConfig(): McpServerConfig[] {
  const raw = config.mcpServersJson.trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    return (arr || []).filter(
      (s): s is McpServerConfig =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as McpServerConfig).id === 'string' &&
        typeof (s as McpServerConfig).command === 'string'
    );
  } catch {
    return [];
  }
}
