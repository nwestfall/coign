/**
 * Generate SRI (Subresource Integrity) hashes for the built bundles.
 * Run after `npm run build` to update dist/sri.json.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const files = [
  'coign-sdk.es.js',
  'coign-sdk.cjs.js',
  'coign-sdk.iife.js',
];

const sri = {};

for (const file of files) {
  const path = resolve('dist', file);
  try {
    const data = readFileSync(path);
    const hash = createHash('sha384').update(data).digest('base64');
    sri[file] = `sha384-${hash}`;
  } catch {
    // File may not exist yet
  }
}

writeFileSync(resolve('dist', 'sri.json'), JSON.stringify(sri, null, 2));
console.log('SRI hashes written to dist/sri.json');
for (const [file, hash] of Object.entries(sri)) {
  console.log(`  ${file}: ${hash}`);
}
