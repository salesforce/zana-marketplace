#!/usr/bin/env node
/** Generate the install catalog and GitHub Pages site from the same entries. */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { assembleMarketplaceIndex, loadMarketplaceEntries, readJson } from './build-lib.mjs';
import { renderSiteFiles } from './site-lib.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(readJson(join(ROOT, 'schema/marketplace.schema.json')));

function filesUnder(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(prefix, entry.name);
    return entry.isDirectory() ? filesUnder(join(dir, entry.name), path) : [path];
  }).sort();
}

export function buildMarketplace(root = ROOT, options = {}) {
  const { base, plugins } = loadMarketplaceEntries(root);
  const index = assembleMarketplaceIndex(base, plugins);
  if (!validate(index)) throw new Error(`marketplace schema validation failed: ${ajv.errorsText(validate.errors)}`);
  // Render before writing: an invalid entry must not partially update the catalog.
  const site = renderSiteFiles(base, plugins);
  const text = `${JSON.stringify(index, null, 2)}\n`;
  const outputs = options.outputs ?? [join(root, 'marketplace.json')];
  const siteDir = options.siteDir === undefined ? join(root, 'docs') : options.siteDir;
  const expected = outputs.map((path) => ({ path, content: text }));
  if (siteDir) expected.push(...site.map((file) => ({ path: join(siteDir, file.path), content: file.content })));
  if (options.check) {
    for (const file of expected) {
      let actual;
      try { actual = readFileSync(file.path, 'utf8'); } catch { /* Missing output is stale too. */ }
      if (actual !== file.content) throw new Error(`Generated file is stale: ${file.path}. Run npm run build.`);
    }
    if (siteDir && JSON.stringify(filesUnder(siteDir)) !== JSON.stringify(site.map((file) => file.path).sort())) {
      throw new Error('Generated site contains stale files. Run npm run build.');
    }
  } else {
    if (siteDir) rmSync(siteDir, { recursive: true, force: true });
    for (const file of expected) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.content);
    }
  }
  return { index, outputs: [...outputs, ...(siteDir ? [`${siteDir}/ (${site.length} files)`] : [])] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/build.mjs [--check]');
    const { index } = buildMarketplace(ROOT, { check: args.includes('--check') });
    console.log(`Marketplace ${args.includes('--check') ? 'checked' : 'built'}: ${index.plugins.length} plugins (${index.name})`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
