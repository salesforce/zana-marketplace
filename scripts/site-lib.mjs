/**
 * Render the static catalog site served by GitHub Pages from docs/.
 * Pure: takes the base + normalized entries (with their website-only `site` block)
 * and returns the files to write. Every page links relatively so the site works
 * under the Pages prefix (/zana-marketplace/).
 */

export const REPO_URL = 'https://github.com/salesforce/zana-marketplace';
export const MARKETPLACE_SOURCE = 'git:https://github.com/salesforce/zana-marketplace.git';
export const PAGES_URL = 'https://opensource.salesforce.com/zana-marketplace/';
export const UNCATEGORIZED = 'More plugins';

/** Top-level paths the site owns; a plugin id cannot shadow them. */
export const RESERVED_IDS = new Set(['assets', 'publish']);

const SECTION_PREVIEW = 3;
const NEW_PREVIEW = 3;

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (ch) => HTML_ESCAPES[ch]);
}

/** Only http(s) links are rendered as anchors; anything else is dropped. */
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/gu, 'and')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function categoryOf(plugin) {
  return plugin.site?.category?.trim() || UNCATEGORIZED;
}

/** Human-readable source location: git URL (+ subdir, ref) or npm package (+ range). */
export function describeSource(source) {
  if (source?.git) {
    const { url, subdir, ref } = source.git;
    const repo = safeUrl(url)?.replace(/\.git$/u, '') ?? null;
    let label = String(url ?? '').replace(/^https?:\/\//u, '').replace(/\.git$/u, '');
    if (subdir) label += `/${subdir}`;
    if (ref) label += `@${ref}`;
    return { label, href: repo };
  }
  if (source?.npm) {
    const { package: pkg, range } = source.npm;
    return { label: `npm:${pkg ?? ''}${range ? `@${range}` : ''}`, href: null };
  }
  return { label: 'unknown source', href: null };
}

/** Featured first, then by name. */
export function compareFeatured(a, b) {
  const rank = (plugin) => (plugin.site?.featured ? 0 : 1);
  return rank(a) - rank(b) || a.displayName.localeCompare(b.displayName);
}

/** Newest `site.addedAt` first; undated entries last, by name. */
export function compareNewest(a, b) {
  const left = a.site?.addedAt ?? '';
  const right = b.site?.addedAt ?? '';
  return right.localeCompare(left) || a.displayName.localeCompare(b.displayName);
}

/** Categories in name order with "More plugins" last. */
export function groupByCategory(plugins) {
  const groups = new Map();
  for (const plugin of [...plugins].sort(compareFeatured)) {
    const name = categoryOf(plugin);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(plugin);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNCATEGORIZED) - (b === UNCATEGORIZED) || a.localeCompare(b))
    .map(([name, items]) => ({ name, slug: slugify(name), plugins: items }));
}

function installCommand(plugin, marketplaceName) {
  return `zcc marketplace install ${plugin.id}@${marketplaceName}`;
}

/** Stable hue per id so letter avatars are distinguishable without icon assets. */
function avatarHue(id) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  return hash;
}

function avatar(plugin, size = '') {
  const url = safeUrl(plugin.icon?.url);
  if (url?.startsWith('https:')) {
    return `<img class="avatar${size}" src="${escapeHtml(url)}" alt="" />`;
  }
  const letter = [...plugin.displayName][0]?.toUpperCase() ?? '?';
  return `<span class="avatar${size}" style="--hue:${avatarHue(plugin.id)}" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

function authorInitial(plugin) {
  return escapeHtml([...String(plugin.author?.name ?? '?')][0]?.toUpperCase() ?? '?');
}

function badge(plugin) {
  return plugin.site?.badge ? `<span class="badge">${escapeHtml(plugin.site.badge)}</span>` : '';
}

function copyBox(command, extraClass = '') {
  return `<div class="cmd${extraClass}"><code><span class="prompt">$</span>${escapeHtml(command)}</code><button type="button" class="copy" data-copy="${escapeHtml(command)}">Copy</button></div>`;
}

/**
 * @param {object} plugin
 * @param {string} prefix relative path to the site root ('./' or '../')
 */
export function renderCard(plugin, prefix) {
  const searchText = [plugin.id, plugin.displayName, plugin.description, categoryOf(plugin), ...(plugin.tags ?? [])]
    .join(' ')
    .toLowerCase();
  return `<a class="card" href="${prefix}${escapeHtml(plugin.id)}/" data-search="${escapeHtml(searchText)}" data-category="${escapeHtml(slugify(categoryOf(plugin)))}" data-name="${escapeHtml(plugin.displayName.toLowerCase())}" data-added="${escapeHtml(plugin.site?.addedAt ?? '')}" data-featured="${plugin.site?.featured ? '1' : '0'}">
  <div class="card-head">${avatar(plugin)}<h3>${escapeHtml(plugin.displayName)}</h3>${badge(plugin)}</div>
  <p class="card-desc">${escapeHtml(plugin.description)}</p>
  <div class="card-foot"><span class="author"><span class="author-dot">${authorInitial(plugin)}</span>${escapeHtml(plugin.author?.name)}</span><span>${escapeHtml(categoryOf(plugin))}</span></div>
</a>`;
}

function section({ id, title, count, description, viewAll, cards, tinted = false }) {
  return `<section class="section${tinted ? ' tinted' : ''}"${id ? ` id="${escapeHtml(id)}"` : ''}>
  <div class="section-head"><div><h2>${escapeHtml(title)} <span class="count">${count}</span></h2>${description ? `<p class="muted">${escapeHtml(description)}</p>` : ''}</div>${viewAll ? `<a class="view-all" href="${escapeHtml(viewAll)}">View all</a>` : ''}</div>
  <div class="grid">${cards}</div>
</section>`;
}

function layout({ title, prefix, body, description }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ''}
<link rel="icon" type="image/svg+xml" href="${prefix}assets/logo.svg" />
<link rel="stylesheet" href="${prefix}assets/site.css" />
</head>
<body>
<header class="nav"><div class="wrap nav-inner">
  <a class="brand" href="${prefix}"><img class="logo" src="${prefix}assets/logo.svg" alt="" width="28" height="28" />Zana <span class="muted">community plugins</span></a>
  <nav>
    <a href="${prefix}">Plugins</a>
    <a href="${REPO_URL}">Repository</a>
    <a class="btn btn-dark" href="${prefix}publish/">Publish a plugin</a>
  </nav>
</div></header>
<a class="skip-link" href="#main">Skip to content</a>
<main class="wrap" id="main">
${body}
</main>
<footer class="wrap footer">
  <span>Public plugins built by the Zana community.</span>
  <span><a href="${prefix}publish/">Publish a plugin</a> · <a href="${REPO_URL}">Repository</a> · <a href="${REPO_URL}/blob/main/marketplace.json">marketplace.json</a></span>
</footer>
<p class="sr-only" id="copy-status" role="status" aria-live="polite"></p>
<script src="${prefix}assets/site.js"></script>
</body>
</html>
`;
}

/**
 * @param {{ name: string, displayName: string, description?: string }} base
 * @param {object[]} plugins normalized entries, `site` included
 */
export function renderIndexPage(base, plugins) {
  const prefix = './';
  const groups = groupByCategory(plugins);
  const featured = plugins.filter((plugin) => plugin.site?.featured).sort(compareFeatured);
  const newest = plugins.filter((plugin) => plugin.site?.addedAt).sort(compareNewest).slice(0, NEW_PREVIEW);
  const cards = (items) => items.map((plugin) => renderCard(plugin, prefix)).join('\n');

  const sections = [];
  if (featured.length > 0) {
    sections.push(section({ title: 'Featured', count: featured.length, description: 'Picked by the Zana team.', cards: cards(featured), tinted: true }));
  }
  // In a catalog this small the category sections already show every plugin.
  if (newest.length > 0 && plugins.length > NEW_PREVIEW) {
    sections.push(section({ title: 'New & notable', count: newest.length, description: 'Most recently added to the catalog.', viewAll: '?sort=new', cards: cards(newest) }));
  }
  for (const group of groups) {
    const more = group.plugins.length > SECTION_PREVIEW;
    sections.push(
      section({
        id: `category-${group.slug}`,
        title: group.name,
        count: group.plugins.length,
        viewAll: more ? `?category=${group.slug}` : null,
        cards: cards(group.plugins.slice(0, SECTION_PREVIEW))
      })
    );
  }

  const options = groups
    .map((group) => `<option value="${escapeHtml(group.slug)}">${escapeHtml(group.name)} (${group.plugins.length})</option>`)
    .join('');
  const empty = plugins.length === 0;

  const body = `<section class="hero">
  <h1>Make Zana yours</h1>
  <p class="lede">Community plugins, installed with one command.</p>
  ${empty ? '' : `<label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="q" placeholder="Search ${plugins.length} plugin${plugins.length === 1 ? '' : 's'}" aria-label="Search plugins" autocomplete="off" /><kbd>/</kbd></label>`}
</section>

<section class="howto">
  <div><strong>Install in Zana</strong><p class="muted">Find this catalog in Zana’s Plugins view. If it’s missing, add it once:</p></div>
  ${copyBox(`zcc marketplace add ${MARKETPLACE_SOURCE}`)}
</section>

${empty ? `<section class="empty-state"><h2>No plugins yet</h2><p class="muted">Be the first to share a community plugin.</p><a class="btn btn-dark" href="${prefix}publish/">Publish a plugin</a></section>` : `<div class="toolbar">
  <select id="category" aria-label="Category"><option value="">All categories</option>${options}</select>
  <div class="segmented" role="group" aria-label="Sort">
    <button type="button" data-sort="featured" aria-pressed="true">Featured</button>
    <button type="button" data-sort="new" aria-pressed="false">New</button>
    <button type="button" data-sort="name" aria-pressed="false">A–Z</button>
  </div>
</div>

<div id="sections">
${sections.join('\n')}
</div>

<section class="section" id="results" hidden>
  <div class="section-head"><div><h2 id="results-title" aria-live="polite" aria-atomic="true">Plugins</h2></div><a class="view-all" href="./" id="clear">Clear filters</a></div>
  <div class="grid" id="results-grid">
${cards([...plugins].sort(compareFeatured))}
  </div>
  <p class="muted" id="no-match" hidden>No plugin matches your search.</p>
</section>`}

<section class="cta">
  <div><h2>Built something useful for Zana?</h2><p class="muted">Share it with the community so everyone can install it with one command.</p></div>
  <a class="btn btn-dark" href="${prefix}publish/">Publish a plugin</a>
</section>`;

  return layout({ title: base.displayName, prefix, body, description: base.description });
}

function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/gu, '<br />')}</p>`)
    .join('\n');
}

/**
 * @param {object} plugin
 * @param {{ name: string, displayName: string }} base
 * @param {object[]} plugins every entry, for "More in <category>"
 */
export function renderPluginPage(plugin, base, plugins) {
  const prefix = '../';
  const category = categoryOf(plugin);
  const slug = slugify(category);
  const source = describeSource(plugin.source);
  const authorUrl = safeUrl(plugin.author?.url);
  const author = authorUrl
    ? `<a href="${escapeHtml(authorUrl)}">${escapeHtml(plugin.author?.name)}</a>`
    : escapeHtml(plugin.author?.name);
  const related = plugins
    .filter((other) => other.id !== plugin.id && categoryOf(other) === category)
    .sort(compareFeatured);
  const shots = (plugin.site?.screenshots ?? [])
    .map((url) => safeUrl(url))
    .filter((url) => url?.startsWith('https:'))
    .map((url) => `<a href="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(plugin.displayName)} screenshot" loading="lazy" /></a>`)
    .join('');
  const tags = (plugin.tags ?? []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');
  const sourceHtml = source.href ? `<a href="${escapeHtml(source.href)}">${escapeHtml(source.label)}</a>` : escapeHtml(source.label);

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}">Marketplace</a><span>/</span><a href="${prefix}?category=${escapeHtml(slug)}">${escapeHtml(category)}</a><span>/</span><span>${escapeHtml(plugin.displayName)}</span></nav>

<section class="detail-head">
  ${avatar(plugin, ' avatar-lg')}
  <div>
    <h1>${escapeHtml(plugin.displayName)} ${badge(plugin)}</h1>
    <p class="meta"><span class="author"><span class="author-dot">${authorInitial(plugin)}</span>${author}</span><span>·</span><a href="${prefix}?category=${escapeHtml(slug)}">${escapeHtml(category)}</a>${plugin.site?.addedAt ? `<span>·</span><span>Added ${escapeHtml(plugin.site.addedAt)}</span>` : ''}</p>
  </div>
</section>

<section class="install">
  ${copyBox(installCommand(plugin, base.name), ' cmd-lg')}
  ${source.href ? `<a class="btn" href="${escapeHtml(source.href)}">View source</a>` : ''}
</section>
<p class="muted small">Not listed in Zana yet? Run <code>zcc marketplace add ${escapeHtml(MARKETPLACE_SOURCE)}</code> once.</p>

${shots ? `<section class="shots">${shots}</section>` : ''}

<div class="detail-body">
  <article class="prose">
    <h2>Overview</h2>
    <p class="lead">${escapeHtml(plugin.description)}</p>
    ${plugin.overview ? paragraphs(plugin.overview) : ''}
  </article>
  <aside class="facts">
    <dl>
      <dt>Plugin id</dt><dd><code>${escapeHtml(plugin.id)}</code></dd>
      <dt>Author</dt><dd>${author}</dd>
      <dt>Category</dt><dd>${escapeHtml(category)}</dd>
      <dt>Source</dt><dd class="break">${sourceHtml}</dd>
      ${tags ? `<dt>Tags</dt><dd><ul class="tags">${tags}</ul></dd>` : ''}
    </dl>
  </aside>
</div>

${related.length > 0 ? section({ title: `More in ${category}`, count: related.length, viewAll: `${prefix}?category=${slug}`, cards: related.slice(0, SECTION_PREVIEW).map((other) => renderCard(other, prefix)).join('\n') }) : ''}`;

  return layout({ title: `${plugin.displayName} — ${base.displayName}`, prefix, body, description: plugin.description });
}

export const EXAMPLE_ENTRY = {
  id: 'my-plugin',
  displayName: 'My plugin',
  description: 'One sentence shown on the catalog card.',
  overview: 'A longer explanation for the plugin page: what it does, what it needs (CLIs, org aliases, permissions) and any caveats.',
  icon: { lucide: 'Puzzle' },
  tags: ['developer-tools'],
  author: { name: 'Your name or team', url: 'https://github.com/your-name' },
  source: { git: { url: 'https://github.com/your-name/zcc-plugin-my-plugin.git', ref: 'v1.0.0' } },
  site: { category: 'Developer Tools', addedAt: '2026-01-31' }
};

const FIELDS = [
  ['id', 'Required', 'Slug (a–z, 0–9, -). Must equal the file name stem.'],
  ['displayName', 'Required', 'Name on the card and plugin page.'],
  ['description', 'Required', 'One sentence for the card.'],
  ['author.name', 'Required', 'Team or person; add author.url to link it.'],
  ['source.git / source.npm', 'Required', 'Where Zana installs from: a public git repository (url, optional subdir and ref) or a published npm package (package, range).'],
  ['overview', 'Optional', 'Longer text for the plugin page (max 4000 characters). Blank lines start new paragraphs.'],
  ['tags, icon', 'Optional', 'Search keywords; icon.url (https) is shown on the website.'],
  ['site.category', 'Website', 'Groups the plugin on the website (max 40 characters). Defaults to "More plugins".'],
  ['site.addedAt', 'Website', 'YYYY-MM-DD; drives "New & notable" and the New sort.'],
  ['site.badge', 'Website', 'Short label next to the name, e.g. "Beta" (max 24 characters).'],
  ['site.screenshots', 'Website', 'Up to 6 https image URLs for the plugin page.'],
  ['site.featured', 'Website', 'Reserved for catalog maintainers.']
];

export function renderPublishPage(base) {
  const prefix = '../';
  const example = `${JSON.stringify(EXAMPLE_ENTRY, null, 2)}\n`;
  const newFileUrl = `${REPO_URL}/new/main/entries?filename=${encodeURIComponent(`${EXAMPLE_ENTRY.id}.json`)}&value=${encodeURIComponent(example)}`;
  const rows = FIELDS.map(([field, kind, text]) => `<tr><td><code>${escapeHtml(field)}</code></td><td><span class="pill pill-${kind.toLowerCase()}">${kind}</span></td><td>${escapeHtml(text)}</td></tr>`).join('');

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}">Marketplace</a><span>/</span><span>Publish a plugin</span></nav>
<section class="hero hero-left">
  <h1>Publish a community plugin</h1>
  <p class="lede">List your plugin with one pull request. The catalog stores only a pointer to your source, and nothing runs until someone installs it.</p>
</section>

<ol class="steps">
  <li><h3>Host your plugin publicly</h3><p class="muted">Push your plugin to a public git repository or publish it to npm. Tag releases so the entry can pin a <code>ref</code>. New to plugins? Start with <code>zcc plugin new &lt;name&gt;</code>.</p></li>
  <li><h3>Add your entry</h3><p class="muted">Create <code>entries/&lt;plugin-id&gt;.json</code> in the marketplace repository. Fork the repository first. The button opens a pre-filled file on GitHub; propose it on a branch to start a pull request.</p>
    <p><a class="btn btn-dark" href="${escapeHtml(newFileUrl)}">Create entry on GitHub</a> <a class="btn" href="${REPO_URL}">Open repository</a></p></li>
  <li><h3>Build and open the pull request</h3><p class="muted">From a clone of the repository, regenerate the manifest and this website, then commit everything together:</p>
    ${copyBox('npm ci && npm run build && npm test && git add entries marketplace.json docs')}
    <p class="muted">Once it merges, your plugin appears here and in Zana's Browse view on the next catalog refresh.</p></li>
</ol>

<section class="section">
  <div class="section-head"><div><h2>Example entry</h2><p class="muted">The <code>site</code> block is for this website only and is removed from <code>marketplace.json</code>.</p></div><button type="button" class="copy view-all" data-copy="${escapeHtml(example)}">Copy</button></div>
  <pre class="code">${escapeHtml(example)}</pre>
</section>

<section class="section">
  <div class="section-head"><div><h2>Fields</h2></div></div>
  <div class="table-wrap"><table><thead><tr><th>Field</th><th>Requirement</th><th>Meaning</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="muted small">Keep listings accurate and sources public. A listing is not an endorsement or a security audit. Each plugin keeps its own license.</p>
</section>`;

  return layout({ title: `Publish a plugin — ${base.displayName}`, prefix, body });
}

export const SITE_CSS = `:root{color-scheme:light dark;--bg:#fff;--fg:#17181c;--muted:#61656f;--line:#e4e6ea;--soft:#f3f5f8;--tint:#eef3f9;--accent:#0b5cad;--dark:#232428;--dark-fg:#fff;--badge-bg:#fdf3d1;--badge-fg:#7a5600;--badge-line:#efd889;--radius:12px}
@media (prefers-color-scheme:dark){:root{--bg:#0f1013;--fg:#e8e9ec;--muted:#9a9fa9;--line:#272a31;--soft:#191b20;--tint:#151b24;--accent:#79b8ff;--dark:#e8e9ec;--dark-fg:#111;--badge-bg:#3a2f0d;--badge-fg:#f4d77a;--badge-line:#5d4b12}}
*{box-sizing:border-box}
:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.skip-link{position:fixed;left:16px;top:-80px;z-index:20;padding:10px 16px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px}.skip-link:focus{top:12px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:inherit}.muted{color:var(--muted)}.small{font-size:13px}.small code{overflow-wrap:anywhere}
code{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--soft);padding:1px 5px;border-radius:5px}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.nav{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{min-width:0;display:flex;align-items:center;gap:10px;font-weight:650;text-decoration:none}
.logo{display:block;width:28px;height:28px}
.nav nav{display:flex;align-items:center;gap:22px}.nav nav a{text-decoration:none;color:var(--muted)}.nav nav a:hover{color:var(--fg)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--fg);text-decoration:none;font:500 14px/1 inherit;cursor:pointer;white-space:nowrap}
.btn:hover{background:var(--soft)}.btn-dark,.nav nav .btn-dark{background:var(--dark);color:var(--dark-fg);border-color:var(--dark)}.btn-dark:hover{opacity:.9;background:var(--dark)}
.hero{text-align:center;padding:64px 0 36px;background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:18px 18px;background-position:center}
.hero h1{font-size:clamp(34px,6vw,54px);line-height:1.08;letter-spacing:-.02em;margin:0 0 12px}
.lede{font-size:18px;color:var(--muted);margin:0 auto 28px;max-width:640px}
.hero-left{text-align:left;background:none;padding:28px 0 12px}.hero-left .lede{margin-left:0}
.search{display:flex;align-items:center;gap:10px;max-width:560px;margin:0 auto;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);box-shadow:0 1px 2px rgb(0 0 0/.04)}
.search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
.search svg{width:18px;height:18px;fill:none;stroke:var(--muted);stroke-width:2;stroke-linecap:round;flex:none}
.search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--fg);font:inherit;font-size:16px;padding:12px 0}
kbd{font:12px ui-monospace,monospace;border:1px solid var(--line);border-radius:5px;padding:1px 6px;color:var(--muted)}
.howto{display:flex;align-items:center;gap:20px;justify-content:space-between;border:1px solid var(--line);border-radius:var(--radius);padding:14px 18px;margin:8px 0 28px}
.howto p{margin:2px 0 0;font-size:13px}.howto .cmd{flex:1;max-width:560px}
.cmd{display:flex;align-items:center;gap:8px;min-width:0;background:var(--soft);border:1px solid var(--line);border-radius:9px;padding:6px 6px 6px 12px}
.cmd code{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;background:none;padding:0}.prompt{color:var(--muted);margin-right:8px;user-select:none}
.cmd-lg{padding:9px 9px 9px 14px}.cmd-lg code{font-size:14px}
.copy{font:500 12px inherit;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:7px;padding:5px 11px;cursor:pointer}.copy:hover{background:var(--soft)}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:20px}
select{font:inherit;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:9px 12px}
.segmented{display:flex;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:3px}
.segmented button{font:inherit;font-size:14px;border:0;background:none;color:var(--muted);padding:6px 13px;border-radius:7px;cursor:pointer}
.segmented button[aria-pressed=true]{background:var(--bg);color:var(--fg);box-shadow:0 1px 2px rgb(0 0 0/.08)}
.section{margin:0 0 28px}.section.tinted{background:var(--tint);border-radius:16px;padding:18px 16px 16px;margin-left:-16px;margin-right:-16px}
.section-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:12px}
.section-head h2{font-size:20px;margin:0}.section-head p{margin:2px 0 0;font-size:14px}.count{font-size:14px;font-weight:500;color:var(--muted)}
.view-all{font-size:14px;color:var(--fg);text-underline-offset:3px;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:14px}
.card{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg);text-decoration:none;transition:border-color .12s,box-shadow .12s}
.card:hover{border-color:color-mix(in srgb,var(--fg) 25%,var(--line));box-shadow:0 4px 14px rgb(0 0 0/.06)}
.card-head{display:flex;align-items:center;gap:10px}.card-head h3{font-size:16px;margin:0}
.card-desc{margin:0;color:var(--muted);flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card-foot{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding-top:10px;font-size:13px;color:var(--muted)}
.avatar{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:9px;border:1px solid var(--line);background:hsl(var(--hue,210) 70% 94%);color:hsl(var(--hue,210) 55% 32%);font-weight:700;object-fit:cover}
@media (prefers-color-scheme:dark){.avatar{background:hsl(var(--hue,210) 35% 20%);color:hsl(var(--hue,210) 70% 80%)}}
.avatar-lg{width:64px;height:64px;border-radius:14px;font-size:26px}
.author{display:inline-flex;align-items:center;gap:6px}.author-dot{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--soft);border:1px solid var(--line);font-size:10px;font-weight:700;color:var(--fg)}
.badge{font-size:12px;font-weight:500;padding:1px 8px;border-radius:6px;background:var(--badge-bg);color:var(--badge-fg);border:1px solid var(--badge-line);vertical-align:middle}
.cta{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:44px 0 0;padding:24px;border-radius:16px;background:var(--tint)}.cta h2{margin:0 0 4px;font-size:20px}.cta p{margin:0}
.empty-state{text-align:center;padding:48px 0}
.crumbs{display:flex;gap:8px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin:28px 0 20px}.crumbs a{text-decoration:none}.crumbs a:hover{color:var(--fg)}
.detail-head{display:flex;gap:18px;align-items:center}.detail-head h1{margin:0;font-size:32px;letter-spacing:-.01em}
.meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:var(--muted);margin:6px 0 0;font-size:14px}.meta a{text-underline-offset:3px}
.install{display:flex;gap:10px;align-items:center;margin:24px 0 8px}.install .cmd{flex:1}
.shots{display:flex;gap:12px;overflow-x:auto;margin:24px 0;padding-bottom:6px}.shots img{height:240px;border-radius:10px;border:1px solid var(--line);display:block}
.detail-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:32px;margin:28px 0 40px}
.prose h2{font-size:20px;margin:0 0 10px}.prose p{margin:0 0 12px}.lead{font-size:17px}
.facts dl{margin:0;border:1px solid var(--line);border-radius:var(--radius);padding:16px;display:grid;grid-template-columns:auto 1fr;gap:10px 14px;font-size:14px}
.facts dt{color:var(--muted)}.facts dd{margin:0;min-width:0}.break{overflow-wrap:anywhere}
.tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0}.tags li{font-size:12px;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:0 8px}
.steps{list-style:none;counter-reset:step;padding:0;margin:20px 0 36px}
.steps li{counter-increment:step;position:relative;padding:0 0 26px 52px;border-left:1px solid var(--line);margin-left:16px}.steps li:last-child{border-left-color:transparent}
.steps li::before{content:counter(step);position:absolute;left:-16px;top:-2px;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--dark);color:var(--dark-fg);font-weight:700}
.steps h3{margin:0 0 4px;font-size:17px}.steps p{margin:0 0 10px}.steps .cmd{max-width:640px;margin-bottom:10px}
.code{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--soft);border:1px solid var(--line);border-radius:var(--radius);padding:16px;overflow-x:auto;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0}
.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:500}
.pill{font-size:12px;padding:1px 8px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}.pill-required{background:var(--dark);color:var(--dark-fg);border-color:var(--dark)}.pill-website{background:var(--tint)}
.footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid var(--line);margin-top:56px;padding-top:20px;padding-bottom:36px;font-size:13px;color:var(--muted)}.footer a{text-underline-offset:3px}
[hidden]{display:none!important}
@media (max-width:480px){.brand .muted{display:none}.nav nav{gap:10px}.wrap{padding-left:16px;padding-right:16px}.detail-head{align-items:flex-start}.detail-head h1{font-size:28px;overflow-wrap:anywhere}.shots img{max-width:100%;height:auto;max-height:240px}}
@media (max-width:720px){.nav nav a:not(.btn){display:none}.howto,.cta,.toolbar,.install{flex-direction:column;align-items:stretch}.howto .cmd{max-width:none}.detail-body{grid-template-columns:1fr}.segmented{justify-content:center}}
`;

export const SITE_JS = `(() => {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const label = button.textContent;
    const status = document.getElementById('copy-status');
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      status.textContent = 'Copied to clipboard.';
    } catch {
      button.textContent = 'Copy failed';
      status.textContent = 'Could not copy. Select and copy the command manually.';
    }
    setTimeout(() => { button.textContent = label; button.disabled = false; }, 1500);
  });

  const q = document.getElementById('q');
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || !q || event.target.closest('input, textarea, select')) return;
    event.preventDefault();
    q.focus();
  });

  const sections = document.getElementById('sections');
  const results = document.getElementById('results');
  if (!q || !sections || !results) return;
  const grid = document.getElementById('results-grid');
  const title = document.getElementById('results-title');
  const noMatch = document.getElementById('no-match');
  const category = document.getElementById('category');
  const sortButtons = [...document.querySelectorAll('[data-sort]')];
  const cards = [...grid.children];
  const sorters = {
    featured: (a, b) => b.dataset.featured.localeCompare(a.dataset.featured) || a.dataset.name.localeCompare(b.dataset.name),
    new: (a, b) => b.dataset.added.localeCompare(a.dataset.added) || a.dataset.name.localeCompare(b.dataset.name),
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name)
  };
  const params = new URLSearchParams(location.search);
  let sort = sorters[params.get('sort')] ? params.get('sort') : 'featured';
  q.value = params.get('q') ?? '';
  category.value = [...category.options].some((o) => o.value === params.get('category')) ? params.get('category') : '';

  function apply() {
    const text = q.value.trim().toLowerCase();
    const filtering = Boolean(text || category.value || sort !== 'featured');
    sections.hidden = filtering;
    results.hidden = !filtering;
    for (const button of sortButtons) button.setAttribute('aria-pressed', String(button.dataset.sort === sort));
    let shown = 0;
    for (const card of [...cards].sort(sorters[sort])) {
      const hit = (!text || card.dataset.search.includes(text)) && (!category.value || card.dataset.category === category.value);
      card.hidden = !hit;
      if (hit) shown += 1;
      grid.append(card);
    }
    const label = category.value ? category.selectedOptions[0].textContent.replace(/ \\(\\d+\\)$/, '') : 'All plugins';
    title.textContent = label + ' (' + shown + ')';
    noMatch.hidden = shown > 0;
    const next = new URLSearchParams();
    if (text) next.set('q', q.value.trim());
    if (category.value) next.set('category', category.value);
    if (sort !== 'featured') next.set('sort', sort);
    history.replaceState(null, '', next.size ? '?' + next : location.pathname);
  }

  q.addEventListener('input', apply);
  category.addEventListener('change', apply);
  for (const button of sortButtons) button.addEventListener('click', () => { sort = button.dataset.sort; apply(); });
  apply();
})();
`;

/**
 * Every file of the site, relative to docs/.
 * @param {{ name: string, displayName: string, description?: string }} base
 * @param {object[]} plugins normalized entries, `site` included
 * @returns {{ path: string, content: string }[]}
 */
// Zana mark, same as the Zana website favicon.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <title>Zana</title>
  <rect width="64" height="64" rx="15" fill="#172641"/>
  <path d="M27 35C17 34 10 27 10 14C20 16 26 24 27 35ZM37 35C47 34 54 26 53 14C44 18 38 25 37 35ZM27 39C19 35 12 39 12 49C19 50 24 46 27 39ZM37 39C45 35 52 39 52 49C45 50 40 46 37 39Z" fill="#9bd7ff"/>
  <circle cx="32" cy="20" r="4" fill="#f0f7ff"/>
  <path d="M32 27C35 31 35 36 36 40C37 45 40 49 42 52C35 55 29 55 22 52C25 49 27 45 28 40C29 36 29 31 32 27Z" fill="#f0f7ff"/>
  <path d="M54 5C55 9 57 11 61 12C57 13 55 15 54 19C53 15 51 13 47 12C51 11 53 9 54 5Z" fill="#ffdb9e"/>
</svg>
`;

export function renderSiteFiles(base, plugins) {
  const reserved = plugins.filter((plugin) => RESERVED_IDS.has(plugin.id)).map((plugin) => plugin.id);
  if (reserved.length > 0) {
    throw new Error(`plugin id ${reserved.join(', ')} is reserved by the catalog website`);
  }
  return [
    { path: '.nojekyll', content: '' },
    { path: 'assets/site.css', content: SITE_CSS },
    { path: 'assets/site.js', content: SITE_JS },
    { path: 'assets/logo.svg', content: LOGO_SVG },
    { path: 'index.html', content: renderIndexPage(base, plugins) },
    { path: 'publish/index.html', content: renderPublishPage(base) },
    ...plugins.map((plugin) => ({ path: `${plugin.id}/index.html`, content: renderPluginPage(plugin, base, plugins) }))
  ];
}
