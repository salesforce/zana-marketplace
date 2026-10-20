# Zana Marketplace

The public plugin marketplace for [Zana](https://github.com/salesforce/zana).

This repository is a catalog of listings. Each listing points to a plugin's
source (a git repository or an npm package). Zana fetches the catalog to show
the available plugins, and installs a plugin only when you ask it to. Refreshing
the catalog never runs plugin code.

## Install a plugin

In Zana, open **Plugins** and browse the marketplace. From a terminal:

```bash
zcc marketplace install <plugin-id>@<marketplace>
```

## Submit a plugin

Open a pull request that adds a listing for your plugin. The plugin's code stays
in your own repository. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Community

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Contributors](CONTRIBUTORS.md)

## License

[MIT](LICENSE.txt)
