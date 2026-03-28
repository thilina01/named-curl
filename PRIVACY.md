# Privacy Policy

Named Curl stores user-defined request data locally in the browser and executes requests directly from the extension. The extension does not operate a remote backend and does not include analytics, advertising, or telemetry code.

## Data Stored Locally

The extension stores the following data on the user's device with `chrome.storage.local`:

- Saved commands, including request names, methods, URLs, headers, bodies, and tags
- Variables and variable bindings used to populate requests from prior responses
- UI preferences such as theme selection

The DevTools panel also stores a small amount of panel-specific UI state in browser local storage, such as filter toggles.

## Network Activity

When a user runs a command, the extension sends the configured HTTP request directly from the browser to the target server selected by the user. The target server receives any request data the user included, such as URLs, headers, and request bodies, and can return response data to the extension.

Named Curl does not proxy requests through a developer-controlled service.

## Data Collection

Named Curl does not collect, sell, transmit, or share extension data with the developer or other third parties, except for the direct network requests that the user explicitly initiates to their chosen destinations.

## Permissions

The extension requests these permissions for the following reasons:

- `storage`: save commands, variables, bindings, and UI preferences locally
- `tabs`: open the options workspace from the popup and DevTools panel
- `<all_urls>` host access: allow users to send requests to arbitrary endpoints they configure

## User Control

Users can edit or delete saved commands and variables from the extension UI at any time. Removing the extension deletes its local extension storage from the browser.

## Changes

If this privacy policy changes, update this file and the public policy URL used in the Chrome Web Store listing.

## Before Publishing

Add your public support contact details or website before submitting to the Chrome Web Store, and host this policy at a public HTTPS URL because the Chrome Web Store review flow expects a reachable privacy policy page.