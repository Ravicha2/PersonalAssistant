/**
 * Convert Markdown to Google Docs API format: plain text + batchUpdate requests
 * so headings, bold, and bullets render as proper Docs formatting (not raw ## or **).
 */

const LINE_BREAK = '\n';

export interface DocFormatOp {
  startIndex: number;
  endIndex: number;
  type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'bullet' | 'bold';
}

export interface MarkdownToDocsResult {
  plainText: string;
  ops: DocFormatOp[];
}

/**
 * Strip **bold** from a line and return plain text plus [start, end] ranges for bold (in line-relative offsets).
 */
function extractBoldRanges(line: string): { text: string; ranges: [number, number][] } {
  const ranges: [number, number][] = [];
  let text = '';
  let i = 0;
  while (i < line.length) {
    const open = line.indexOf('**', i);
    if (open === -1) {
      text += line.slice(i);
      break;
    }
    text += line.slice(i, open);
    const contentStart = text.length;
    const close = line.indexOf('**', open + 2);
    if (close === -1) {
      text += line.slice(open);
      break;
    }
    const plain = line.slice(open + 2, close);
    text += plain;
    ranges.push([contentStart, contentStart + plain.length]);
    i = close + 2;
  }
  return { text, ranges };
}

/**
 * Parse markdown and return plain text (no ##, ###, -, **) and format ops with 1-based indices for Docs API.
 */
export function markdownToDocsContent(md: string): MarkdownToDocsResult {
  const lines = md.split(/\r?\n/);
  const ops: DocFormatOp[] = [];
  const parts: string[] = [];
  let globalIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const rest = raw.trimStart();
    const bulletMatch = rest.match(/^[-*]\s+(.*)$/);
    const headingMatch = rest.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const afterHash = headingMatch[2].replace(/#+$/, '').trim();
      const { text: lineText, ranges: boldRanges } = extractBoldRanges(afterHash);
      const lineContent = lineText + LINE_BREAK;
      const start = globalIndex;
      const end = globalIndex + lineContent.length;
      if (level <= 4) {
        ops.push({
          startIndex: start,
          endIndex: end,
          type: `heading${level}` as 'heading1' | 'heading2' | 'heading3' | 'heading4',
        });
      }
      for (const [a, b] of boldRanges) {
        ops.push({ startIndex: start + a, endIndex: start + b, type: 'bold' });
      }
      parts.push(lineContent);
      globalIndex = end;
      continue;
    }

    if (bulletMatch) {
      const { text: lineText, ranges: boldRanges } = extractBoldRanges(bulletMatch[1]);
      const lineContent = lineText + LINE_BREAK;
      const start = globalIndex;
      const end = globalIndex + lineContent.length;
      ops.push({ startIndex: start, endIndex: end, type: 'bullet' });
      for (const [a, b] of boldRanges) {
        ops.push({ startIndex: start + a, endIndex: start + b, type: 'bold' });
      }
      parts.push(lineContent);
      globalIndex = end;
      continue;
    }

    const { text: lineText, ranges: boldRanges } = extractBoldRanges(rest || raw);
    const lineContent = lineText + LINE_BREAK;
    const start = globalIndex;
    const end = globalIndex + lineContent.length;
    for (const [a, b] of boldRanges) {
      ops.push({ startIndex: start + a, endIndex: start + b, type: 'bold' });
    }
    parts.push(lineContent);
    globalIndex = end;
  }

  const plainText = parts.join('');
  return { plainText, ops };
}

/** Build batchUpdate requests (excluding insertText) for the given format ops. */
export function buildFormatRequests(ops: DocFormatOp[]): object[] {
  const requests: object[] = [];
  for (const op of ops) {
    if (op.type.startsWith('heading')) {
      const level = op.type.slice(-1) as '1' | '2' | '3' | '4';
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: op.startIndex, endIndex: op.endIndex },
          paragraphStyle: { namedStyleType: `HEADING_${level}` },
          fields: 'namedStyleType',
        },
      });
    } else if (op.type === 'bullet') {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: op.startIndex, endIndex: op.endIndex },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    } else if (op.type === 'bold') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: op.startIndex, endIndex: op.endIndex },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
  }
  return requests;
}
