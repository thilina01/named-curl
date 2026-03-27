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

## Notes

- The app stores commands in a single canonical header format: arrays of `{ key, value }`.
- Legacy result pages and the unused background execution path were removed during the maintainability refactor.
- The extension remains build-free: plain HTML, CSS, and ES modules.
