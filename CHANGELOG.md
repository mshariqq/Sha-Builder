# Changelog

All notable changes to **Sha Builder** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Repository restructured for release automation: the plugin now lives in the
  `ShaBuilder/` folder, with docs, issue templates, and a release workflow added.

## [2.1.1] - 2026-08-03

### Fixed

- PHP code was not executing for non-admin users.

## [2.1.0]

### Added

- Custom Functions admin page for site-wide PHP code execution.

### Fixed

- Plugin header version out of sync with the `SHA_BUILDER_VERSION` constant.
- Broken PHP code could crash the builder UI.
- Global header/footer not applied on theme builder pages (cart, my_account, etc.).

## [2.0.5]

### Changed

- Template system fixes: post context setup, recursion guard, and PHP caching removal.
- Builder mode bar layout fix.

## [2.0.4]

### Changed

- Version bump and stability fixes.

## [2.0.2]

### Added

- Visual inline style editor with computed CSS loading, property groups,
  `data-original` tracking, and duplicate prevention.

## [2.0.1]

### Added

- Inline editing, undo/redo, custom CSS, and PHP protection.

### Fixed

- Inspect overlay scroll issue.

## [1.3.0]

### Added

- Per-page header/footer override via the Sha Builder meta box.
- Auto-render preview (800ms debounce) across HTML, CSS, and JS editors.
- Frontend asset injection into the preview iframe (theme CSS, jQuery, JS).

### Changed

- Builder performance: auto-render skips the loading overlay for non-PHP changes.

### Fixed

- Scroll-triggered/theme animations now work in the builder preview.

## [1.2.0]

### Added

- PHP code execution directly in the HTML editor (`<?php`, `<?=`, `<?`).
- Cache system under `wp-content/uploads/sha-builder/cache/`, regenerated on save.
- PHP support in the builder live preview (via AJAX) and in custom headers/footers.
- Cache directory protection (`.htaccess` / `web.config`).
- PHP warning toast when saving content that contains PHP.

### Changed

- Preview script execution: Blob URL page context, removed iframe sandbox restriction.
- Deactivation cleanup now removes all cache files.

## [1.1.0]

### Added

- Initial release: live preview, element inspector, CSS property editor,
  override system, and responsive preview.