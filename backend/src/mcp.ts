/**
 * MCP client: list tools and call tools.
 * Optional: when no MCP servers are configured, tools are no-op / return message.
 * For full MCP, use @modelcontextprotocol/sdk and connect via stdio/SSE.
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpClientInterface {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

/** No-op MCP client when no servers are configured. */
export class NoopMcpClient implements McpClientInterface {
  async listTools(): Promise<McpTool[]> {
    return [];
  }
  async callTool(name: string, _args: Record<string, unknown>): Promise<string> {
    return `Tool "${name}" is not configured (no MCP servers).`;
  }
}

/** In-memory mock for development: echo, add, etc. */
export class MockMcpClient implements McpClientInterface {
  private tools: McpTool[] = [
    { name: 'echo', description: 'Echo back the message', inputSchema: { type: 'object', properties: { message: { type: 'string' } } } },
    { name: 'add', description: 'Add two numbers', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } } },
  ];

  async listTools(): Promise<McpTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === 'echo') return String(args.message ?? '');
    if (name === 'add') return String(Number(args.a) + Number(args.b));
    return `Unknown tool: ${name}`;
  }
}

export function createMcpClient(): McpClientInterface {
  // Use mock when no MCP server URL/command is set; replace with real MCP client when configured.
  return new MockMcpClient();
}
