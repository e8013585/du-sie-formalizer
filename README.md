# Du↔Sie Formalizer

Convert German text between informal (Du) and formal (Sie) register using Claude AI (Anthropic).

## Features

- **Popup** — Quick conversion in a compact 320px window with streaming output
- **Side Panel** — Full workspace with side-by-side LCS diff view and 10-entry history
- **Context Menu** — Right-click any selected text on any page and convert it instantly
- **Tone Intensity** — Standard, Polished, or Strict Corporate intensity for nuanced results
- **i18n** — Full English and German localisation; RTL support for Arabic/Hebrew/Farsi/Urdu
- **Keyboard Shortcut** — `Ctrl+Enter` / `Cmd+Enter` to convert from either textarea
- **Dark Mode** — Automatically adapts to system colour scheme

## Permissions Justification

| Permission | Reason |
|---|---|
| `storage` | Stores your Anthropic API key, conversion history (last 10 entries), tone intensity preference, and mode preference. All data stays in your browser — never sent to any server except the Anthropic API. |
| `contextMenus` | Adds the "Du↔Sie Formalizer" right-click menu so you can convert selected text on any page. |
| `activeTab` | Grants temporary access to the currently active tab only when you click a context menu item. This allows the extension to show the floating result card and optionally replace the selected text. No background access to all tabs. |
| `scripting` | Required alongside `activeTab` to inject the content script (`content.js`) on demand when a context menu conversion is triggered. The script is injected into the active tab only, never into all URLs automatically. |
| `sidePanel` | Opens the full workspace in Chrome's side panel via `chrome.sidePanel.open()`. |
| `host_permissions` (`https://api.anthropic.com/*`) | Strictly limited to Anthropic's API endpoint. No other hosts are contacted. Used solely to send the text you want converted and receive the result. |

## Architecture

```
manifest.json        MV3 manifest
api.js               Shared API logic (streaming + non-streaming)
background.js        Service worker: context menus, dynamic content injection
content.js           Injected into active tab on demand: floating card, text replacement
popup.html/css/js    320px popup window
sidepanel.html/css/js Full workspace with diff and history
_locales/en/         English i18n strings
_locales/de/         German i18n strings
```

**Key design decisions:**

- No `<all_urls>` permission — content scripts are injected dynamically only when the user triggers a context menu action, via `chrome.scripting.executeScript` with `activeTab`
- No analytics, no telemetry, no external requests other than to `api.anthropic.com`
- All DOM built with `createElement` / `appendChild` — zero `innerHTML` usage
- Streaming SSE parser handles Anthropic's `content_block_delta` event format end-to-end

## Setup

1. Install the extension from the Chrome Web Store (or load it unpacked from this directory)
2. Click the extension icon → click the gear icon → enter your Anthropic API key
3. Paste or type German text and click **Convert**, or right-click any selection on any page

## Data Handling

- **API key**: Stored in `chrome.storage.local` — never sent anywhere except Anthropic's API
- **Text content**: Sent to Anthropic's API for conversion; nothing is stored or logged
- **History**: Last 10 conversions saved locally in `chrome.storage.local`; can be cleared at any time
- **No tracking**: The extension does not collect analytics, use cookies, or contact any server other than the Anthropic API
