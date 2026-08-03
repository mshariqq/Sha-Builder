# Contributing to Sha Builder

Thanks for taking the time to contribute! This project is free and open source
under the **GNU General Public License v2 or later**.

## Ways to contribute

- **Report bugs** — open an issue using the Bug report template.
- **Request features** — open an issue using the Feature request template.
- **Fix bugs / add features** — submit a pull request.
- **Improve docs** — the site lives in `/docs` (GitHub Pages) and the README covers usage.

## Repository layout

- `ShaBuilder/` — the WordPress plugin. This folder is zipped and shipped as a
  release artifact; keep it self-contained and installable (main file
  `sha-builder.php` at its root).
- `docs/` — the GitHub Pages landing site.
- `.github/` — issue templates and CI/CD (see `release.yml`).

## Getting started

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Install the plugin locally by copying `ShaBuilder/` into
   `wp-content/plugins/` or by uploading the built `ShaBuilder.zip`.
4. Make your changes.
5. Run a quick sanity check: activate the plugin, open the builder on a page,
   and confirm the preview and Save still work. There is no automated test
   suite today, so manual verification on a recent WordPress + PHP 7.4 install
   is expected.

## Coding conventions

- Follow the existing code style (PHP 7.4 compatible, WordPress coding style).
- All PHP plugin files require the `ABSPATH` guard (`if (!defined('ABSPATH')) exit;`).
- Do not add inline comments unless they genuinely aid readability.
- Keep functions and classes focused; prefer the existing class structure in
  `ShaBuilder/includes/`.

## Releases

Releases are tagged `v*.*.*`. The `.github/workflows/release.yml` workflow
zips `ShaBuilder/` into `ShaBuilder.zip`, verifies it, and attaches it to the
release. Keep `SHA_BUILDER_VERSION` and the plugin header `Version:` in sync.

## Submitting changes

1. Commit with a clear message (reference the issue number when relevant).
2. Keep the `main` branch green.
3. Open a pull request and describe what changed and why.
4. Respond to review feedback.

## License

By contributing, you agree that your contributions are licensed under the
[GPL v2 or later](LICENSE).