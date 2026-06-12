/**
 * Built-in tool: getElement
 * Returns one element's text, HTML, attributes, and bounding rect.
 */

import type { GetElementArgs, GetElementResult, ToolDefinition } from '../../types.js';

export const getElementTool: ToolDefinition = {
  name: 'getElement',
  description:
    'Read the contents of a single DOM element identified by a CSS selector. Returns text, HTML, attributes, and viewport status. Use this when the model already knows which element it wants to inspect.',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector' },
      includeHidden: { type: 'boolean', default: false },
      maxHtmlBytes: { type: 'integer', default: 4096 },
    },
    required: ['selector'],
  },
  risk: 'read',
  execute: async (args: GetElementArgs): Promise<GetElementResult> => {
    const el = document.querySelector(args.selector);
    if (!el) {
      return {
        found: false,
        selector: args.selector,
        text: '',
        html: '',
        attributes: {},
        inViewport: false,
      };
    }

    const style = window.getComputedStyle(el);
    const isHidden = style.display === 'none' || style.visibility === 'hidden';
    if (isHidden && !args.includeHidden) {
      return {
        found: false,
        selector: args.selector,
        text: '',
        html: '',
        attributes: {},
        inViewport: false,
      };
    }

    const rect = el.getBoundingClientRect();
    const inViewport =
      rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;

    let html = el.outerHTML;
    // Simple sanitization: strip script/style/event handlers
    html = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '');

    const maxBytes = args.maxHtmlBytes ?? 4096;
    if (html.length > maxBytes) {
      html = html.slice(0, maxBytes) + '\n... [truncated]';
    }

    const attributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attributes[attr.name] = attr.value;
    }

    return {
      found: true,
      selector: args.selector,
      text: el.textContent?.trim() ?? '',
      html,
      attributes,
      boundingRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      inViewport,
    };
  },
};
