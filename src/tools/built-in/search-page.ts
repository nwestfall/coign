/**
 * Built-in tool: searchPage
 * Full-text search across the page's visible text using MiniSearch.
 */

import MiniSearch from 'minisearch';
import type { SearchPageArgs, SearchPageResult, SearchHit, ToolDefinition } from '../../types.js';

export const searchPageTool: ToolDefinition = {
  name: 'searchPage',
  description:
    'Full-text search across the page\'s visible text. Returns hits with snippets, heading breadcrumbs, and CSS selectors. Use this when the user asks about specific content on the page.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (1–200 chars)' },
      scope: { type: 'string', description: 'Optional CSS selector to limit search scope' },
      maxResults: { type: 'integer', default: 5, description: 'Max results to return (cap 20)' },
      contextTokens: { type: 'integer', default: 200, description: 'Snippet length in tokens (cap 2000)' },
      matchMode: { type: 'string', enum: ['any', 'all', 'phrase'], default: 'any' },
      caseSensitive: { type: 'boolean', default: false },
      fields: {
        type: 'array',
        items: { type: 'string', enum: ['text', 'headings', 'links', 'alt'] },
        default: ['text', 'headings'],
      },
    },
    required: ['query'],
  },
  risk: 'read',
  execute: async (args: SearchPageArgs): Promise<SearchPageResult> => {
    if (args.query.length > 200) {
      return { query: args.query, totalMatches: 0, returned: 0, hits: [], truncated: false, hint: 'wrong_scope' };
    }

    const scope = args.scope || 'main, [role="main"], article';
    let root: Element | null = document.querySelector(scope);
    if (!root) root = document.body;

    // Gather text nodes
    const documents: Array<{ id: string; text: string; headings: string; selector: string }> = [];
    let idCounter = 0;

    function walk(el: Element, headingPath: string[]) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript') return;

      const newPath = [...headingPath];
      if (/^h[1-6]$/.test(tag)) {
        newPath.push(el.textContent?.trim() ?? '');
      }

      if (el.children.length === 0) {
        const text = el.textContent?.trim() ?? '';
        if (text.length > 0) {
          documents.push({
            id: String(idCounter++),
            text,
            headings: newPath.join(' > '),
            selector: stableSelector(el),
          });
        }
      } else {
        for (const child of Array.from(el.children)) {
          walk(child, newPath);
        }
      }
    }

    for (const child of Array.from(root.children)) {
      walk(child, []);
    }

    if (documents.length === 0) {
      return { query: args.query, totalMatches: 0, returned: 0, hits: [], truncated: false, hint: 'no_matches' };
    }

    const mini = new MiniSearch({
      fields: ['text', 'headings'],
      storeFields: ['text', 'headings', 'selector'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
      },
    });

    mini.addAll(documents);

    const results = mini.search(args.query, { prefix: true, fuzzy: 0.2 });
    const max = Math.min(args.maxResults ?? 5, 20);
    const returned = results.slice(0, max);

    const hits: SearchHit[] = returned.map((r) => ({
      score: r.score,
      snippet: r.text as string,
      source: {
        selector: r.selector as string,
        headingPath: (r.headings as string).split(' > ').filter(Boolean),
        charStart: 0,
      },
    }));

    return {
      query: args.query,
      totalMatches: results.length,
      returned: hits.length,
      hits,
      truncated: results.length > max,
      hint: results.length === 0 ? 'no_matches' : results.length > max ? 'too_broad' : undefined,
    };
  },
};

function stableSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).join('.');
  if (cls) return `${tag}.${cls}`;
  return tag;
}
