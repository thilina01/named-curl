# Named Curl

Named Curl is a Chrome extension for saving named HTTP requests, executing them from the browser, and turning captured DevTools traffic into reusable commands.

## Project Structure

- `manifest.json`: Chrome extension manifest and top-level permissions
- `options.html`: main workspace shell
- `popup.html`: popup launcher shell
- `devtools.html`: DevTools panel entry shell
- `devtools-panel.html`: DevTools capture panel shell
- `shared/`: canonical shared logic used by multiple pages
- `options/`: workspace entry module
- `popup/`: popup entry module
- `devtools/`: DevTools entry modules

## Canonical Storage Model

### Commands

```json
{
  "id": "cmd_...",
  "name": "Get Users",
  "method": "GET",
  "url": "https://api.example.com/users",
  "tags": ["users", "prod"],
  "headers": [
    { "key": "Accept", "value": "application/json" }
  ],
  "body": ""
}
```

### Variables

```json
{
  "key": "TOKEN",
  "value": "secret",
  "sensitive": true
}
```

### Variable Bindings

```json
{
  "variableKey": "USER_ID",
  "segments": ["data", 0, "id"],
  "path": "response.data[0].id",
  "commandId": "cmd_...",
  "sourceRequestName": "Get Users",
  "sourceRequestUrl": "https://api.example.com/users"
}
```

## Shared Modules

- `shared/storage.js`: state loading, normalization, and persistence
- `shared/request.js`: variable resolution, header sanitization, and request execution
- `shared/curl.js`: cURL parsing helpers
- `shared/utils.js`: small shared formatting and escaping helpers
- `shared/constants.js`: storage keys and shared constants

## Verification

- `npm run test`: shared-module behavior checks
- `npm run check`: syntax validation for all refactored ES modules

## Publishing

- `scripts/tag.sh`: local version bump and tagging helper for GitHub releases
- `.github/workflows/release.yml`: tag-driven GitHub Release packaging and publishing workflow
- `.github/workflows/pages.yml`: GitHub Pages deployment for the public privacy policy site
- `CHROME_WEB_STORE.md`: Chrome Web Store submission notes, permission rationale, and release checklist
- `PRIVACY.md`: privacy policy draft for hosting before store submission

### Public Privacy Policy

The repository includes a small GitHub Pages site under `docs/`.

- Privacy policy page: `docs/privacy-policy/index.html`
- Expected public URL: `https://thilina01.github.io/named-curl/privacy-policy/`

After the Pages workflow runs successfully, enable GitHub Pages in the repository settings if GitHub has not already done so for the workflow-based deployment.

### GitHub Release Flow

1. Run `./scripts/tag.sh` on `master` with `patch`, `minor`, or `major`.
2. The script verifies the repo state, updates `manifest.json`, runs tests, commits the version bump, creates an annotated tag, and pushes it.
3. Pushing a `vX.Y.Z` tag triggers the GitHub workflow.
4. The workflow validates the tag against `manifest.json`, packages the extension zip with `INSTALL.txt`, generates release notes from the previous tag, and creates the GitHub Release.

## Notes

- The app stores commands in a single canonical header format: arrays of `{ key, value }`.
- Commands can have multiple tags, and tag filtering is designed for match-all combinations.
- Legacy result pages and the unused background execution path were removed during the maintainability refactor.
- The extension remains build-free: plain HTML, CSS, and ES modules.
