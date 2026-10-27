# Zana Marketplace

The public plugin marketplace for [Zana](https://github.com/salesforce/zana).

**Browse plugins:** <https://salesforce.github.io/zana-marketplace/>

This repository is a catalog of listings. Each listing points to a plugin's
source (a git repository or an npm package). Zana fetches the catalog to show
the available plugins, and installs a plugin only when you ask it to. Refreshing
the catalog never runs plugin code.

## Install a plugin

Register this community catalog once, then browse it in **Plugins**:

```bash
zcc marketplace add git:https://github.com/salesforce/zana-marketplace.git
```

From a terminal, install a listed plugin with:

```bash
zcc marketplace install orgo-machines-6758@zana-community
```

## Submit a plugin

Open a pull request that adds a listing for your plugin. The plugin's code stays
in your own repository. See [CONTRIBUTING.md](CONTRIBUTING.md).

The [publishing guide](https://salesforce.github.io/zana-marketplace/publish/)
includes an example entry and a pre-filled GitHub submission link.

## Catalog and website

| Path | Role |
| --- | --- |
| `marketplace.base.json` | Catalog identity (`zana-community`) |
| `entries/<plugin-id>.json` | One public plugin listing per file |
| `schema/marketplace.schema.json` | Install catalog JSON Schema |
| `scripts/` | Catalog validation and static website generator |
| `marketplace.json` | Generated install catalog, committed for Zana's `git:` source |
| `docs/` | Generated website, committed and deployed to GitHub Pages |

Node.js 22 or later is required. Build and validate with:

```bash
npm ci
npm run build
npm test
npm run check
```

`npm run check` fails if the committed catalog or website is stale. Edit the
entries and generator rather than generated files. Existing plugin IDs, source
refs and the catalog name remain stable.

Listings may include website-only metadata in a `site` block: `category`,
`addedAt` (`YYYY-MM-DD`), `badge`, `screenshots` (up to six HTTPS URLs), and
`featured` (maintainers only). The build removes this block from the install
catalog, whose schema rejects unknown fields. Plugin IDs `assets` and `publish`
are reserved for website routes.

For a local preview with the same URL prefix as Pages:

```bash
node scripts/serve.mjs
```

Open `http://127.0.0.1:4180/zana-marketplace/`. Browser tests run on desktop and
mobile Chromium, in light and dark themes:

```bash
npx playwright install chromium
npm run test:e2e
```

The **Marketplace website** workflow validates pull requests and deploys `docs/`
after successful checks on `main`. Repository Settings → Pages must use
**GitHub Actions** as the publishing source. No plugins or remote plugin code
are installed during the website build.

## Community

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Contributors](CONTRIBUTORS.md)

## License

[MIT](LICENSE.txt)
