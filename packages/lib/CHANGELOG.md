# Changelog

## [Unreleased]

### Added

-   Vite v6+ compatibility support
-   Automatic Vite version detection and compatibility adjustments
-   Enhanced module resolution patterns for different Vite versions
-   Debug logging capability with `window.__ESM_FEDERATION_DEBUG`
-   Better error handling in federation discovery script

### Fixed

-   **Critical**: Fixed shared dependencies being incorrectly overridden by import maps
-   **Critical**: Fixed shared dependencies being incorrectly marked as external modules
-   **Breaking**: Fixed module resolution issues with Vite v6.3.5+
-   Fixed "Failed to resolve module specifier" errors in newer Vite versions
-   Fixed shared dependencies (like react-dom) being fetched from wrong remote URLs
-   Fixed import map generation to respect local shared dependencies
-   Improved import map generation for stricter ES module resolution
-   Enhanced regex patterns to support multiple Vite dependency path formats
-   Added safety checks for missing manifest properties

### Changed

-   Updated peer dependencies to support Vite v4, v5, and v6+
-   Improved federation discovery script with better error handling
-   Enhanced shared module transformation for multiple Vite versions
-   Improved resolveId logic to properly distinguish between remotes and shared dependencies

## Previous Versions

See git history for previous version changes.
