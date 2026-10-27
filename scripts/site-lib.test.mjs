import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { buildMarketplace } from './build.mjs';
import { assembleMarketplaceIndex, normalizeEntry, toManifestEntry, validateSite } from './build-lib.mjs';
import {
  EXAMPLE_ENTRY,
  MARKETPLACE_SOURCE,
  REPO_URL,
  UNCATEGORIZED,
  categoryOf,
  compareFeatured,
  compareNewest,
  describeSource,
  escapeHtml,
  groupByCategory,
  renderCard,
  renderIndexPage,
  renderPluginPage,
  renderPublishPage,
  renderSiteFiles,
  safeUrl,
  slugify
} from './site-lib.mjs';

const base = { name: 'zana-community', displayName: 'Zana Community', description: 'Community' };

function entry(id, overrides = {}) {
  return {
    id,
    displayName: id.toUpperCase(),
    description: `${id} <does> things & more`,
    author: { name: 'chatbots', url: 'https://github.com/example' },
    source: { git: { url: `https://github.com/example/${id}.git`, ref: 'main' } },
    ...overrides
  };
}

const gus = entry('gus', {
  overview: 'First paragraph.\n\nSecond <b>paragraph</b>\nwith a break.',
  tags: ['community', 'gus'],
  site: { category: 'Work Tracking', addedAt: '2026-09-16', badge: 'Beta', screenshots: ['https://cdn.example/a.png'] }
});
const board = entry('board', { site: { category: 'Work Tracking', addedAt: '2026-10-01', featured: true } });
const loose = entry('loose');

describe('escapeHtml', () => {
  it('escapes markup and quotes, nullish as empty', () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    assert.equal(escapeHtml(undefined), '');
  });
});

describe('safeUrl', () => {
  it('keeps http(s) and drops other schemes or junk', () => {
    assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
    assert.equal(safeUrl('javascript:alert(1)'), null);
    assert.equal(safeUrl('not a url'), null);
    assert.equal(safeUrl(42), null);
  });
});

describe('slugify / categoryOf', () => {
  it('slugs category names and defaults the category', () => {
    assert.equal(slugify('Code & Reviews!'), 'code-and-reviews');
    assert.equal(categoryOf(gus), 'Work Tracking');
    assert.equal(categoryOf(loose), UNCATEGORIZED);
    assert.equal(categoryOf(entry('x', { site: { category: '   ' } })), UNCATEGORIZED);
  });
});

describe('describeSource', () => {
  it('labels a git source with subdir and ref and links the repo', () => {
    assert.deepEqual(
      describeSource({ git: { url: 'https://github.com/salesforce/zana.git', subdir: 'plugins/docs', ref: 'v1' } }),
      { label: 'github.com/salesforce/zana/plugins/docs@v1', href: 'https://github.com/salesforce/zana' }
    );
  });

  it('does not link a non-http git url', () => {
    assert.equal(describeSource({ git: { url: 'git@github.com:a/b.git' } }).href, null);
  });

  it('labels an npm source and falls back for a missing one', () => {
    assert.deepEqual(describeSource({ npm: { package: '@sf/x', range: '^1.2.0' } }), { label: 'npm:@sf/x@^1.2.0', href: null });
    assert.equal(describeSource({ npm: { package: '@sf/x' } }).label, 'npm:@sf/x');
    assert.equal(describeSource(undefined).label, 'unknown source');
  });
});

describe('ordering', () => {
  it('sorts featured first, newest first, and groups categories with More plugins last', () => {
    assert.deepEqual([gus, loose, board].sort(compareFeatured).map((p) => p.id), ['board', 'gus', 'loose']);
    assert.deepEqual([loose, gus, board].sort(compareNewest).map((p) => p.id), ['board', 'gus', 'loose']);
    const zeta = entry('zeta', { site: { category: 'Zeta' } });
    assert.deepEqual(
      groupByCategory([loose, zeta, gus, board]).map((g) => [g.name, g.slug, g.plugins.map((p) => p.id)]),
      [
        ['Work Tracking', 'work-tracking', ['board', 'gus']],
        ['Zeta', 'zeta', ['zeta']],
        [UNCATEGORIZED, 'more-plugins', ['loose']]
      ]
    );
  });
});

describe('renderCard', () => {
  it('links the plugin page and carries filter data', () => {
    const html = renderCard(gus, './');
    assert.match(html, /<a class="card" href="\.\/gus\/"/);
    assert.match(html, /data-category="work-tracking"/);
    assert.match(html, /data-added="2026-09-16"/);
    assert.match(html, /data-featured="0"/);
    assert.match(html, /gus &lt;does&gt; things &amp; more/);
    assert.match(html, /<span class="badge">Beta<\/span>/);
    assert.match(html, /<span class="avatar" style="--hue:\d+" aria-hidden="true">G<\/span>/);
  });

  it('renders only https icon urls', () => {
    assert.match(renderCard(entry('i', { icon: { url: 'https://cdn.example/i.png' } }), './'), /<img class="avatar" src="https:\/\/cdn\.example\/i\.png"/);
    assert.doesNotMatch(renderCard(entry('i', { icon: { url: 'http://cdn.example/i.png' } }), './'), /<img/);
  });
});

describe('renderIndexPage', () => {
  it('renders hero, install hint, sections, results and publish CTA', () => {
    const many = ['a', 'b', 'c', 'd'].map((id) => entry(id, { site: { category: 'Tools' } }));
    const html = renderIndexPage(base, [gus, board, loose, ...many]);
    assert.match(html, /<title>Zana Community<\/title>/);
    assert.match(html, /<meta name="description" content="Community" \/>/);
    assert.ok(html.includes(`zcc marketplace add ${MARKETPLACE_SOURCE}`));
    assert.match(html, /placeholder="Search 7 plugins"/);
    assert.match(html, /<h2>Featured <span class="count">1<\/span>/);
    assert.match(html, /<h2>New &amp; notable <span class="count">2<\/span>/);
    assert.match(html, /id="category-tools"[\s\S]*?Tools <span class="count">4<\/span>[\s\S]*?href="\?category=tools">View all/);
    assert.doesNotMatch(html, /href="\?category=work-tracking">View all/);
    assert.match(html, /<option value="more-plugins">More plugins \(1\)<\/option>/);
    assert.match(html, /id="results" hidden/);
    assert.match(html, /href="\.\/publish\/"/);
    assert.match(html, /href="\.\/assets\/site\.css"/);
    assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/assets\/logo\.svg"/);
    assert.match(html, /<img class="logo" src="\.\/assets\/logo\.svg"/);
  });

  it('skips New & notable when the categories already show every plugin', () => {
    const html = renderIndexPage(base, [gus, board]);
    assert.doesNotMatch(html, /New &amp; notable/);
    assert.match(html, /Work Tracking <span class="count">2<\/span>/);
  });

  it('omits featured and new sections when no entry sets them', () => {
    const html = renderIndexPage({ ...base, description: undefined }, [loose]);
    assert.doesNotMatch(html, /Featured <span|New &amp; notable/);
    assert.doesNotMatch(html, /<meta name="description"/);
    assert.match(html, /placeholder="Search 1 plugin"/);
  });

  it('shows an empty state without search or filters', () => {
    const html = renderIndexPage(base, []);
    assert.match(html, /No plugins yet/);
    assert.doesNotMatch(html, /id="q"|id="category"/);
  });

  it('keeps category section ids separate from search UI ids', () => {
    const html = renderIndexPage(base, [entry('results-plugin', { site: { category: 'Results' } })]);
    assert.match(html, /id="category-results"/);
    assert.equal([...html.matchAll(/id="results"/g)].length, 1);
  });
});

describe('renderPluginPage', () => {
  it('renders install, overview, screenshots, facts and related plugins', () => {
    const unsafeShot = { ...gus, site: { ...gus.site, screenshots: [...gus.site.screenshots, 'http://cdn.example/b.png'] } };
    const html = renderPluginPage(unsafeShot, base, [unsafeShot, board, loose]);
    assert.match(html, /<title>GUS — Zana Community<\/title>/);
    assert.match(html, /href="\.\.\/\?category=work-tracking">Work Tracking<\/a>/);
    assert.match(html, /zcc marketplace install gus@zana-community/);
    assert.match(html, /class="btn" href="https:\/\/github\.com\/example\/gus">View source/);
    assert.match(html, /<p>First paragraph\.<\/p>\n<p>Second &lt;b&gt;paragraph&lt;\/b&gt;<br \/>with a break\.<\/p>/);
    assert.match(html, /<img src="https:\/\/cdn\.example\/a\.png"/);
    assert.doesNotMatch(html, /cdn\.example\/b\.png/);
    assert.match(html, /Added 2026-09-16/);
    assert.match(html, /<li>gus<\/li>/);
    assert.match(html, /More in Work Tracking <span class="count">1<\/span>[\s\S]*href="\.\.\/board\/"/);
    assert.match(html, /src="\.\.\/assets\/site\.js"/);
  });

  it('degrades without optional fields or safe links', () => {
    const bare = entry('bare', { author: { name: 'x', url: 'javascript:alert(1)' }, source: { npm: { package: '@sf/bare', range: '1.0.0' } } });
    const html = renderPluginPage(bare, base, [bare]);
    assert.doesNotMatch(html, /javascript:|View source|class="shots"|More in|Added |class="tags"/);
    assert.match(html, /npm:@sf\/bare@1\.0\.0/);
  });
});

describe('renderPublishPage', () => {
  it('links a prefilled new-file form and documents the fields', () => {
    const html = renderPublishPage(base);
    const href = html.match(/href="([^"]+)">Create entry on GitHub/)[1].replace(/&amp;/g, '&');
    const url = new URL(href);
    assert.equal(url.origin + url.pathname, `${REPO_URL}/new/main/entries`);
    assert.equal(url.searchParams.get('filename'), 'my-plugin.json');
    assert.deepEqual(JSON.parse(url.searchParams.get('value')), EXAMPLE_ENTRY);
    assert.match(html, /<code>site\.category<\/code>/);
    assert.match(html, /npm ci &amp;&amp; npm run build &amp;&amp; npm test &amp;&amp; git add entries marketplace\.json docs/);
  });

  it('ships an example entry that passes validation', () => {
    assert.equal(normalizeEntry(EXAMPLE_ENTRY, 'my-plugin.json').ok, true);
  });
});

describe('renderSiteFiles', () => {
  it('lists every page and asset', () => {
    assert.deepEqual(
      renderSiteFiles(base, [gus, loose]).map((file) => file.path),
      ['.nojekyll', 'assets/site.css', 'assets/site.js', 'assets/logo.svg', 'index.html', 'publish/index.html', 'gus/index.html', 'loose/index.html']
    );
  });

  it('refuses ids that shadow site paths', () => {
    assert.throws(() => renderSiteFiles(base, [entry('publish')]), /plugin id publish is reserved/);
  });
});

describe('site block', () => {
  it('accepts valid site fields and rejects bad ones', () => {
    assert.deepEqual(validateSite(undefined, 'a.json'), []);
    assert.deepEqual(validateSite(gus.site, 'a.json'), []);
    assert.deepEqual(validateSite([], 'a.json'), ['a.json: site must be an object when set']);
    const errors = validateSite(
      { category: '', badge: 'x'.repeat(25), featured: 'yes', addedAt: '2026/01/01', screenshots: ['http://x'], extra: 1 },
      'a.json'
    );
    assert.equal(errors.length, 6);
    assert.match(errors.join('\n'), /site\.extra is not a known field/);
    assert.equal(validateSite({ screenshots: 'https://x' }, 'a.json').length, 1);
    assert.equal(normalizeEntry({ ...gus, site: { addedAt: 'soon' } }, 'gus.json').ok, false);
  });

  it('never reaches marketplace.json, whose parser is strict', () => {
    assert.equal('site' in toManifestEntry(gus), false);
    const index = assembleMarketplaceIndex(base, [gus, board]);
    assert.ok(index.plugins.every((plugin) => !('site' in plugin)));
  });
});

describe('buildMarketplace site output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zana-marketplace-site-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('rebuilds the site directory and keeps site out of the manifest', () => {
    const root = join(dir, 'repo');
    mkdirSync(join(root, 'entries'), { recursive: true });
    writeFileSync(join(root, 'marketplace.base.json'), JSON.stringify({ schemaVersion: 1, ...base }));
    writeFileSync(join(root, 'entries', 'gus.json'), JSON.stringify(gus));
    const manifest = join(dir, 'marketplace.json');
    const site = join(dir, 'docs');
    mkdirSync(join(site, 'removed-plugin'), { recursive: true });

    const { outputs } = buildMarketplace(root, { outputs: [manifest], siteDir: site, validate: false });
    assert.deepEqual(outputs, [manifest, `${site}/ (7 files)`]);
    assert.equal(JSON.parse(readFileSync(manifest, 'utf8')).plugins[0].site, undefined);
    assert.match(readFileSync(join(site, 'gus', 'index.html'), 'utf8'), /zcc marketplace install gus@zana-community/);
    assert.equal(existsSync(join(site, '.nojekyll')), true);
    assert.equal(existsSync(join(site, 'removed-plugin')), false);
  });

  it('skips the site when siteDir is null', () => {
    const root = join(dir, 'repo');
    const { outputs } = buildMarketplace(root, { outputs: [], siteDir: null, validate: false });
    assert.deepEqual(outputs, []);
  });
});
