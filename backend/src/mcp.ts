/**
 * MCP client: list tools and call tools.
 * Built-in: echo, add (demo); Google (Calendar, Docs) per-user via Connectors; Docling (parse_document) when DOCLING_ENABLED=1.
 * External: Google Workspace MCP or other MCPs in Connectors.
 */

import { getConnector } from './store/connectors.js';
import { createCalendarEvent, listCalendarEvents } from './calendar.js';
import { createGoogleDoc } from './google-docs.js';
import { listExternalTools, callExternalTool, hasExternalTool } from './external-mcp.js';
import { isDoclingAvailable, convertToMarkdown } from './docling.js';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpClientInterface {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

const CALENDAR_TOOLS: McpTool[] = [
  {
    name: 'create_calendar_event',
    description: 'Create a new event on the user\'s Google Calendar. Pass start and end in ISO 8601 UTC (e.g. 2026-03-13T16:55:00Z). If the user does not specify duration, use 1 hour. endTime must be after startTime.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title' },
        startTime: { type: 'string', description: 'Start datetime ISO 8601 UTC' },
        endTime: { type: 'string', description: 'End datetime ISO 8601 UTC' },
        description: { type: 'string', description: 'Optional event description' },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming events from the user\'s Google Calendar.',
    inputSchema: { type: 'object', properties: { maxResults: { type: 'number', description: 'Max events to return (default 10)' } } },
  },
  {
    name: 'create_google_doc',
    description: 'Create a new Google Doc with the given title and body content. Use when the user asks to put a summary or text in a doc.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Full body text' },
      },
      required: ['title', 'content'],
    },
  },
];

const MOCK_TOOLS: McpTool[] = [
  { name: 'echo', description: 'Echo back the message', inputSchema: { type: 'object', properties: { message: { type: 'string' } } } },
  { name: 'add', description: 'Add two numbers', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } } },
];

const DOCLING_TOOLS: McpTool[] = [
  {
    name: 'parse_document',
    description: 'Convert a document (PDF, DOCX, PPTX, HTML, etc.) to markdown using Docling. Pass a URL (e.g. https://example.com/doc.pdf) or an absolute file path. Use when the user wants to summarize, analyze, or answer questions about a document.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the document (HTTP/HTTPS)' },
        file_path: { type: 'string', description: 'Absolute path to the file on the server (alternative to url)' },
      },
      required: [],
    },
  },
];

export class UserMcpClient implements McpClientInterface {
  constructor(
    private userId: string,
    private calendarCredentials: string | null
  ) {}

  async listTools(): Promise<McpTool[]> {
    const tools = [...MOCK_TOOLS];
    if (this.calendarCredentials) tools.push(...CALENDAR_TOOLS);
    if (isDoclingAvailable()) tools.push(...DOCLING_TOOLS);
    const builtInNames = new Set(tools.map((t) => t.name));
    const external = await listExternalTools(this.userId);
    for (const t of external) {
      if (!builtInNames.has(t.name)) {
        tools.push(t);
        builtInNames.add(t.name);
      }
    }
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === 'echo') return String(args.message ?? '');
    if (name === 'add') return String(Number(args.a) + Number(args.b));

    if (name === 'create_calendar_event' && this.calendarCredentials) {
      const summary = String(args.summary ?? '');
      const startTime = String(args.startTime ?? '');
      const endTime = String(args.endTime ?? '');
      const description = args.description != null ? String(args.description) : undefined;
      if (!summary || !startTime || !endTime) return 'Error: summary, startTime, and endTime are required.';
      try {
        return await createCalendarEvent(this.calendarCredentials, summary, startTime, endTime, description);
      } catch (e) {
        return `Error creating event: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (name === 'list_calendar_events' && this.calendarCredentials) {
      const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 10;
      try {
        return await listCalendarEvents(this.calendarCredentials, maxResults);
      } catch (e) {
        return `Error listing events: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (name === 'create_google_doc' && this.calendarCredentials) {
      const title = String(args.title ?? '').trim();
      const content = String(args.content ?? '').trim();
      if (!title || !content) return 'Error: title and content are required for create_google_doc.';
      try {
        return await createGoogleDoc(this.calendarCredentials, title, content);
      } catch (e) {
        return `Error creating document: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (name === 'parse_document' && isDoclingAvailable()) {
      const url = typeof args.url === 'string' ? args.url.trim() : '';
      const filePath = typeof args.file_path === 'string' ? args.file_path.trim() : '';
      const urlOrPath = url || filePath;
      if (!urlOrPath) return 'Error: provide either "url" (document URL) or "file_path" (absolute path on server).';
      try {
        const markdown = await convertToMarkdown(urlOrPath);
        return markdown.slice(0, 150_000) || '(No content extracted)';
      } catch (e) {
        return `Error parsing document: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const externalHas = await hasExternalTool(this.userId, name);
    if (externalHas) return callExternalTool(this.userId, name, args);

    return `Tool "${name}" is not available. Connect Google in Connectors, enable Docling (DOCLING_ENABLED=1) for parse_document, or add external MCP servers.`;
  }
}

export async function createMcpClient(userId?: string | null): Promise<McpClientInterface> {
  if (!userId) return new UserMcpClient('', null);
  const googleConn = await getConnector(userId, 'google');
  const googleCredentials = googleConn?.credentials ?? null;
  return new UserMcpClient(userId, googleCredentials);
}
