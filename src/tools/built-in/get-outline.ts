/**
 * Built-in tool: getPageOutline
 * Returns a Markdown block with the page's headings, landmarks, form fields, JSON-LD, OpenGraph data.
 */

import type { GetPageOutlineArgs, ToolDefinition } from '../../types.js';
import { buildPageOutline, outlineToMarkdown } from '../../core/context.js';

export const getPageOutlineTool: ToolDefinition = {
  name: 'getPageOutline',
  description:
    'Returns a structured outline of the current page: headings, landmarks, forms, structured data (JSON-LD), and OpenGraph tags. Use this when the user asks "what is this page about?" or wants a high-level summary.',
  parameters: {
    type: 'object',
    properties: {
      refresh: { type: 'boolean', default: false, description: 'Force a re-extract of the outline' },
    },
  },
  risk: 'read',
  execute: async (_args: GetPageOutlineArgs): Promise<string> => {
    const outline = buildPageOutline('main, [role="main"], article');
    return outlineToMarkdown(outline);
  },
};
