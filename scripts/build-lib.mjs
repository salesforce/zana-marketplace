/**
 * Pure helpers for assembling a Zana marketplace.json from entries/.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENTRY_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const OVERVIEW_MAX_CHARS = 4000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SITE_TEXT_MAX_CHARS = { category: 40, badge: 24 };
const SCREENSHOTS_MAX = 6;

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listEntryFiles(entriesDir) {
  return readdirSync(entriesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

/**
 * Normalize icon: BB-style lucide string → `{ lucide }`.
 * @param {unknown} icon
 */
export function normalizeIcon(icon) {
  if (typeof icon === 'string' && icon.length > 0) return { lucide: icon };
  if (icon && typeof icon === 'object' && !Array.isArray(icon)) {
    const out = {};
    if (typeof icon.lucide === 'string' && icon.lucide.length > 0) out.lucide = icon.lucide;
    if (typeof icon.url === 'string' && icon.url.length > 0) out.url = icon.url;
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

/**
 * Validate the optional website-only `site` block. It never reaches marketplace.json:
 * Zana's manifest parser is strict and would reject unknown entry fields.
 * @param {unknown} site
 * @param {string} fileName
 * @returns {string[]} errors
 */
export function validateSite(site, fileName) {
  if (site === undefined) return [];
  if (!site || typeof site !== 'object' || Array.isArray(site)) {
    return [`${fileName}: site must be an object when set`];
  }
  const errors = [];
  const allowed = new Set(['category', 'badge', 'featured', 'addedAt', 'screenshots']);
  for (const key of Object.keys(site)) {
    if (!allowed.has(key)) errors.push(`${fileName}: site.${key} is not a known field`);
  }
  for (const [field, max] of Object.entries(SITE_TEXT_MAX_CHARS)) {
    const value = site[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
      errors.push(`${fileName}: site.${field} must be a non-empty string of at most ${max} characters`);
    }
  }
  if (site.featured !== undefined && typeof site.featured !== 'boolean') {
    errors.push(`${fileName}: site.featured must be a boolean`);
  }
  if (site.addedAt !== undefined && (typeof site.addedAt !== 'string' || !DATE_PATTERN.test(site.addedAt))) {
    errors.push(`${fileName}: site.addedAt must be a YYYY-MM-DD date`);
  }
  if (site.screenshots !== undefined) {
    const shots = site.screenshots;
    if (
      !Array.isArray(shots) ||
      shots.length > SCREENSHOTS_MAX ||
      !shots.every((shot) => typeof shot === 'string' && shot.startsWith('https://'))
    ) {
      errors.push(`${fileName}: site.screenshots must be at most ${SCREENSHOTS_MAX} https URLs`);
    }
  }
  return errors;
}

/** Drop website-only fields so the entry matches Zana's strict manifest schema. */
export function toManifestEntry(entry) {
  const { site: _site, ...manifestEntry } = entry;
  return manifestEntry;
}

/**
 * Validate one entry object (structural checks; AJV runs separately when available).
 * @param {unknown} raw
 * @param {string} fileName
 * @returns {{ ok: true, entry: object } | { ok: false, errors: string[] }}
 */
export function normalizeEntry(raw, fileName) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [`${fileName}: entry must be a JSON object`] };
  }
  const entry = { ...raw };
  const expectedId = fileName.replace(/\.json$/u, '');
  if (typeof entry.id !== 'string' || !ENTRY_ID_PATTERN.test(entry.id)) {
    errors.push(`${fileName}: id must match ${ENTRY_ID_PATTERN}`);
  } else if (entry.id !== expectedId) {
    errors.push(`${fileName}: id must equal "${expectedId}" (file stem)`);
  }
  for (const field of ['displayName', 'description']) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      errors.push(`${fileName}: ${field} is required`);
    }
  }
  if (!entry.author || typeof entry.author !== 'object' || typeof entry.author.name !== 'string') {
    errors.push(`${fileName}: author.name is required`);
  }
  const source = entry.source;
  if (!source || typeof source !== 'object') {
    errors.push(`${fileName}: source is required`);
  } else if (!source.npm && !source.git) {
    errors.push(`${fileName}: source must declare npm or git`);
  }
  if (entry.overview !== undefined) {
    if (typeof entry.overview !== 'string' || entry.overview.trim().length === 0) {
      errors.push(`${fileName}: overview must be a non-empty string when set`);
    } else if ([...entry.overview].length > OVERVIEW_MAX_CHARS) {
      errors.push(`${fileName}: overview exceeds ${OVERVIEW_MAX_CHARS} characters`);
    }
  }
  errors.push(...validateSite(entry.site, fileName));
  const icon = normalizeIcon(entry.icon);
  if (icon) entry.icon = icon;
  else delete entry.icon;

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, entry };
}

/**
 * @param {object} base marketplace.base.json
 * @param {object[]} plugins normalized entries
 */
export function assembleMarketplaceIndex(base, plugins) {
  const sorted = [...plugins].sort((a, b) => a.displayName.localeCompare(b.displayName));
  return {
    schemaVersion: 1,
    name: base.name,
    displayName: base.displayName,
    ...(typeof base.description === 'string' && base.description.trim()
      ? { description: base.description.trim() }
      : {}),
    plugins: sorted.map(toManifestEntry)
  };
}

/**
 * Load and normalize every entries/*.json file.
 * @param {string} marketplaceRoot
 */
export function loadMarketplacePlugins(marketplaceRoot) {
  const { base, plugins } = loadMarketplaceEntries(marketplaceRoot);
  return assembleMarketplaceIndex(base, plugins);
}

/**
 * Like loadMarketplacePlugins, but keeps each entry's website-only `site` block.
 * @param {string} marketplaceRoot
 * @returns {{ base: object, plugins: object[] }}
 */
export function loadMarketplaceEntries(marketplaceRoot) {
  const base = readJson(join(marketplaceRoot, 'marketplace.base.json'));
  if (base.schemaVersion !== 1) {
    throw new Error('marketplace.base.json: schemaVersion must be 1');
  }
  if (typeof base.name !== 'string' || !ENTRY_ID_PATTERN.test(base.name)) {
    throw new Error('marketplace.base.json: name must be a slug');
  }
  if (typeof base.displayName !== 'string' || !base.displayName.trim()) {
    throw new Error('marketplace.base.json: displayName is required');
  }

  const entriesDir = join(marketplaceRoot, 'entries');
  const files = listEntryFiles(entriesDir);
  // Empty catalogs are valid (e.g. a new marketplace with no listings yet).

  const errors = [];
  const seen = new Set();
  const plugins = [];
  for (const file of files) {
    let raw;
    try {
      raw = readJson(join(entriesDir, file));
    } catch (err) {
      errors.push(`${file}: invalid JSON (${err instanceof Error ? err.message : err})`);
      continue;
    }
    const result = normalizeEntry(raw, file);
    if (!result.ok) {
      errors.push(...result.errors);
      continue;
    }
    if (seen.has(result.entry.id)) {
      errors.push(`${file}: duplicate id "${result.entry.id}"`);
      continue;
    }
    seen.add(result.entry.id);
    plugins.push(result.entry);
  }

  if (errors.length > 0) {
    const error = new Error(errors.join('\n'));
    error.errors = errors;
    throw error;
  }

  return { base, plugins };
}
