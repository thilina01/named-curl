# Chrome Web Store Readiness

This project is close to publishable. The core manifest structure is valid for a Manifest V3 extension, the extension now includes packaged icon assets, and the current codebase has a straightforward privacy story because requests are executed directly from the browser and saved locally.

## Current Gaps

1. Host the privacy policy from `PRIVACY.md` at a public HTTPS URL for the store listing.
2. Prepare Chrome Web Store listing assets such as screenshots and any optional promotional images.
3. Perform a packaged-extension smoke test before upload.

## Permissions Review Notes

Current manifest permissions:

- `storage`: required for saved commands, variables, bindings, and theme settings
- `tabs`: required because the popup and DevTools panel open the options page in a browser tab
- `<all_urls>` host permissions: required because the product allows user-defined requests to arbitrary endpoints

Review risk is concentrated around `<all_urls>`. Keep the store description explicit that this is an API request tool and that broad host access exists so users can call the endpoints they configure.

## Recommended Manifest Follow-Up

The manifest already includes packaged PNG icons at 16, 32, 48, and 128 pixels under `icons/`.

## Suggested Store Copy

### Short Description

Save, organize, and run named API requests directly from Chrome, with tags, variables, and DevTools capture.

### Detailed Description

Named Curl is a lightweight API workflow extension for Chrome.

- Save reusable HTTP requests with names, headers, bodies, and tags.
- Run requests directly from the popup or full options workspace.
- Capture requests from DevTools and turn them into reusable commands.
- Reuse variables across requests and extract values from JSON responses.
- Filter commands by multiple tags to keep large request libraries manageable.

All request data is stored locally in the browser. Requests are sent directly to the destinations chosen by the user.

## Submission Checklist

1. Bump the extension version in `manifest.json`.
2. Run `npm test`.
3. Run `npm run check`.
4. Load the unpacked extension in Chrome and verify popup, options page, request execution, and DevTools capture.
5. Host the privacy policy at a public HTTPS URL and add that URL in the store listing.
6. Prepare screenshots that show the popup, options workspace, tag filtering, and DevTools capture panel.
7. Package the extension as a zip of the extension root, excluding `.git`, `node_modules`, and other local-only files.

## Packaging Notes

Zip the contents of the extension project root so the archive contains `manifest.json` at the top level. Do not zip a parent folder that wraps the extension files.

## Final Pre-Submission Review

Confirm that the store listing, privacy policy, and screenshots all describe the same product behavior that exists in the codebase:

- local storage only
- no analytics or remote backend
- direct user-initiated requests to configured endpoints
- DevTools capture and saved-command workflow