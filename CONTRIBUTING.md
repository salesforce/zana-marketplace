# Contributing to the Zana Marketplace

Thanks for contributing. Plugin listings, fixes to existing listings, and issue
reports are welcome.

## Before You Start

- Search [existing issues](https://github.com/salesforce/zana-marketplace/issues)
  before opening a new one. Report problems with a listing using the
  [Bug report](https://github.com/salesforce/zana-marketplace/issues/new?template=bug.yml)
  template.
- Report bugs in a plugin itself to that plugin's repository, and bugs in Zana
  to [salesforce/zana](https://github.com/salesforce/zana/issues).
- For security vulnerabilities, follow the private reporting process in
  [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Submitting a Plugin

1. Fork the repository and create a focused branch from `main`.
2. Add one listing to the `plugins` array in root `marketplace.json` (Zana
   catalog schema version 1). Keep the entry ID equal to the installed plugin
   ID. Point its source at a public git repository or a published npm package. Do not add plugin code to this repository.
3. Check that the plugin installs and runs in a current Zana build.
4. Open a pull request against `main`. Describe what the plugin does, the
   permissions it requests, and how you tested it.

## Pull Request Expectations

- One plugin per pull request.
- Keep the description accurate. Say what the plugin does and what it needs
  (CLIs, accounts, network access).
- You must own the plugin or have permission to list it.
- Be responsive to review feedback and keep the branch current with `main`.

## Review

Maintainers review listings for accuracy, security, and fit with Zana. A listing
is not an endorsement or a security audit of the plugin. Maintainers may remove
a listing that is broken, unmaintained, or unsafe.

## License

By contributing, you agree that your contributions to this repository are
licensed under the [MIT License](LICENSE.txt). Each listed plugin keeps its own
license.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
