import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { buildMarketplace } from './build.mjs';
import { loadMarketplaceEntries, normalizeEntry, normalizeIcon } from './build-lib.mjs';
import { renderSiteFiles } from './site-lib.mjs';

const base = { schemaVersion: 1, name: 'zana-community', displayName: 'Zana Community' };
const plugin = { id: 'example', displayName: 'Example', description: 'An example', author: { name: 'Example' }, source: { git: { url: 'https://github.com/example/plugin.git', ref: 'v1' } } };

describe('catalog validation and generated output', () => {
  const root = mkdtempSync(join(tmpdir(), 'public-marketplace-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  beforeEach(() => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, 'entries'), { recursive: true });
    writeFileSync(join(root, 'marketplace.base.json'), JSON.stringify(base));
    writeFileSync(join(root, 'entries/example.json'), JSON.stringify(plugin));
  });

  it('checks without writing and detects missing, changed, and obsolete generated files', () => {
    assert.throws(() => buildMarketplace(root, { check: true }), /Generated file is stale/);
    buildMarketplace(root);
    assert.equal(buildMarketplace(root, { check: true }).index.name, 'zana-community');
    writeFileSync(join(root, 'docs/index.html'), 'old content');
    assert.throws(() => buildMarketplace(root, { check: true }), /Generated file is stale/);
    buildMarketplace(root);
    writeFileSync(join(root, 'docs/obsolete.html'), 'old page');
    assert.throws(() => buildMarketplace(root, { check: true }), /contains stale files/);
    buildMarketplace(root);
    assert.doesNotThrow(() => buildMarketplace(root, { check: true }));
  });

  it('rejects schema-invalid sources before modifying existing outputs', () => {
    buildMarketplace(root);
    const previous = readFileSync(join(root, 'marketplace.json'), 'utf8');
    writeFileSync(join(root, 'entries/example.json'), JSON.stringify({ ...plugin, source: { npm: { package: 'example' } } }));
    assert.throws(() => buildMarketplace(root), /schema validation failed/);
    assert.equal(readFileSync(join(root, 'marketplace.json'), 'utf8'), previous);
  });

  it('rejects website path conflicts before modifying the manifest', () => {
    buildMarketplace(root);
    const previous = readFileSync(join(root, 'marketplace.json'), 'utf8');
    writeFileSync(join(root, 'entries/publish.json'), JSON.stringify({ ...plugin, id: 'publish' }));
    assert.throws(() => buildMarketplace(root), /reserved/);
    assert.equal(readFileSync(join(root, 'marketplace.json'), 'utf8'), previous);
  });

  it('supports validation only, without writing', () => {
    assert.deepEqual(buildMarketplace(root, { outputs: [], siteDir: null, check: true }).outputs, []);
  });

  it('checks marketplace identity and invalid JSON with actionable errors', () => {
    for (const [identity, error] of [
      [{ ...base, schemaVersion: 2 }, /schemaVersion/],
      [{ ...base, name: '../oops' }, /name must be a slug/],
      [{ ...base, displayName: ' ' }, /displayName is required/]
    ]) {
      writeFileSync(join(root, 'marketplace.base.json'), JSON.stringify(identity));
      assert.throws(() => loadMarketplaceEntries(root), error);
    }
    writeFileSync(join(root, 'marketplace.base.json'), JSON.stringify(base));
    writeFileSync(join(root, 'entries/example.json'), '{bad');
    assert.throws(() => loadMarketplaceEntries(root), /example.json: invalid JSON/);
  });

  it('rejects unknown manifest fields rather than silently dropping them', () => {
    writeFileSync(join(root, 'entries/example.json'), JSON.stringify({ ...plugin, unexpected: true }));
    assert.throws(() => buildMarketplace(root), /additional properties/);
  });

  it('ignores non-listing files and permits an empty catalog', () => {
    rmSync(join(root, 'entries/example.json'));
    writeFileSync(join(root, 'entries/README.md'), 'Documentation');
    assert.deepEqual(buildMarketplace(root).index.plugins, []);
  });
});

describe('entry failure paths', () => {
  it('handles invalid icon forms', () => {
    for (const icon of [null, [], '', 1, {}]) assert.equal(normalizeIcon(icon), undefined);
    assert.deepEqual(normalizeIcon({ lucide: 'Monitor', url: 'https://example.com/icon.svg' }), { lucide: 'Monitor', url: 'https://example.com/icon.svg' });
  });

  it('rejects invalid entries and missing fields', () => {
    for (const raw of [null, [], 1, { ...plugin, id: '../oops' }, { ...plugin, description: '' }, { ...plugin, author: {} }, { ...plugin, source: undefined }, { ...plugin, overview: '' }, { ...plugin, overview: 'a'.repeat(4001) }]) {
      assert.equal(normalizeEntry(raw, 'example.json').ok, false);
    }
    assert.equal(normalizeEntry({ ...plugin, icon: null }, 'example.json').entry.icon, undefined);
  });
});

describe('public site boundary', () => {
  it('uses only public marketplace links, community copy and the existing catalog identity', () => {
    const files = renderSiteFiles(base, [plugin]);
    const html = files.filter((file) => file.path.endsWith('.html')).map((file) => file.content).join('\n');
    assert.doesNotMatch(html, /git\.soma|Salesforce-internal|VPN|Artifactory|@internal/);
    assert.match(html, /zcc marketplace install example@zana-community/);
    assert.match(html, /https:\/\/github.com\/salesforce\/zana-marketplace/);
    assert.match(html, /Skip to content/);
  });

  it('escapes untrusted listing text and omits executable URLs', () => {
    const unsafe = { ...plugin, displayName: '<script>alert(1)</script>', author: { name: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' }, source: { git: { url: 'javascript:alert(1)' } } };
    const html = renderSiteFiles(base, [unsafe]).map((file) => file.content).join('\n');
    assert.doesNotMatch(html, /<script>alert|<img src=x|href="javascript:/);
    assert.match(html, /&lt;script&gt;/);
  });
});
