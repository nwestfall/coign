/**
 * Page context extraction — the "always" tier.
 * Uses Readability for the main article, plus a custom extractor
 * for landmarks, forms, JSON-LD, and OpenGraph.
 */

import type { PageOutline } from '../types.js';

export function buildPageOutline(selectDOM: string): PageOutline {
  const root = document.querySelector(selectDOM) || document.body;
  const title = document.title;
  const url = location.href;

  const headings: PageOutline['headings'] = [];
  root.querySelectorAll('h1, h2, h3').forEach((el) => {
    const level = parseInt(el.tagName[1], 10) as 1 | 2 | 3;
    headings.push({
      level,
      text: el.textContent?.trim() ?? '',
      id: el.id || undefined,
    });
  });

  const landmarks: PageOutline['landmarks'] = [];
  root.querySelectorAll('[role], main, nav, aside, header, footer, form').forEach((el) => {
    const role = el.getAttribute('role') || inferLandmarkRole(el);
    if (!role) return;
    landmarks.push({
      role,
      label: el.getAttribute('aria-label') || el.getAttribute('title') || undefined,
      selector: stableSelector(el),
    });
  });

  const links: PageOutline['links'] = [];
  root.querySelectorAll('a[href]').forEach((el, i) => {
    if (i >= 200) return;
    links.push({
      text: el.textContent?.trim() ?? '',
      href: (el as HTMLAnchorElement).href,
      rel: el.getAttribute('rel') || undefined,
    });
  });

  const structuredData: PageOutline['structuredData'] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const data = JSON.parse(el.textContent || '{}');
      const type = Array.isArray(data) ? data[0]?.['@type'] : data['@type'];
      if (type) {
        structuredData.push({ type, data });
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  const openGraph: Record<string, string> = {};
  document.querySelectorAll('meta[property^="og:"]').forEach((el) => {
    const prop = el.getAttribute('property');
    const content = el.getAttribute('content');
    if (prop && content) {
      openGraph[prop] = content;
    }
  });

  const forms: PageOutline['forms'] = [];
  root.querySelectorAll('form').forEach((form) => {
    const fields: Array<{ name: string; type: string; required: boolean }> = [];
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      const name = field.getAttribute('name') || field.getAttribute('id') || '';
      const type = (field as HTMLInputElement).type || field.tagName.toLowerCase();
      const required = field.hasAttribute('required');
      if (name) fields.push({ name, type, required });
    });
    forms.push({
      selector: stableSelector(form),
      action: (form as HTMLFormElement).action || '',
      fields,
    });
  });

  const text = root.textContent || '';
  const tokenEstimate = Math.ceil(text.length / 4);

  return {
    title,
    url,
    headings,
    landmarks,
    links,
    structuredData,
    openGraph,
    forms,
    tokenEstimate,
  };
}

function inferLandmarkRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'main':
      return 'main';
    case 'nav':
      return 'navigation';
    case 'aside':
      return 'complementary';
    case 'header':
      return 'banner';
    case 'footer':
      return 'contentinfo';
    case 'form':
      return 'form';
    default:
      return null;
  }
}

function stableSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).join('.');
  if (cls) return `${tag}.${cls}`;
  return tag;
}

export function outlineToMarkdown(outline: PageOutline): string {
  let md = `# ${outline.title}\nURL: ${outline.url}\n\n`;

  if (outline.headings.length) {
    md += `## Headings\n`;
    for (const h of outline.headings) {
      md += `${'#'.repeat(h.level)} ${h.text}\n`;
    }
    md += '\n';
  }

  if (outline.landmarks.length) {
    md += `## Landmarks\n`;
    for (const lm of outline.landmarks) {
      md += `- ${lm.role}${lm.label ? ` "${lm.label}"` : ''}\n`;
    }
    md += '\n';
  }

  if (outline.structuredData.length) {
    md += `## Structured data\n`;
    for (const sd of outline.structuredData) {
      md += `- ${sd.type}\n`;
    }
    md += '\n';
  }

  if (Object.keys(outline.openGraph).length) {
    md += `## OpenGraph\n`;
    for (const [k, v] of Object.entries(outline.openGraph)) {
      md += `- ${k}: ${v}\n`;
    }
    md += '\n';
  }

  if (outline.forms.length) {
    md += `## Forms\n`;
    for (const f of outline.forms) {
      md += `- ${f.selector} → ${f.action}\n`;
      for (const field of f.fields) {
        md += `  - ${field.name} (${field.type}${field.required ? ', required' : ''})\n`;
      }
    }
    md += '\n';
  }

  return md;
}
