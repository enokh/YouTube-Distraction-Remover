# YouTube Distraction Remover — Design Document

## Overview

A Chrome browser extension (Manifest V3) that removes distracting content from YouTube,
helping the user focus on content from channels they have chosen to follow.

---

## Goals

1. Remove all YouTube Shorts from every surface (shelves, sidebar, dedicated page)
2. On the watch page, hide the recommendations sidebar — show only the video and comments (live chat is preserved on livestreams)
3. On the homepage, offer two modes for controlling what the user sees:
   - **Basic**: hide all recommended videos and redirect to the Subscriptions feed
   - **Advanced**: keep the homepage feed but filter it to only show videos from subscribed channels

---

## Non-Goals

- Will not modify YouTube's recommendation algorithm
- Will not block ads (separate concern, separate tooling)
- Firefox / Safari support (can be added later; focus is Chrome for now)

---

## Architecture

```
no_shorts_extension/
├── manifest.json       # Extension metadata and permissions (Manifest V3)
├── popup.html          # Extension popup — mode selector UI
├── popup.js            # Popup logic — reads/writes storage, messages active tabs
├── content.js          # Main content script — runs on every YouTube page
├── styles.css          # CSS hide rules — applied immediately on page load
└── DESIGN.md           # This file
```

### Why two files (JS + CSS)?

CSS rules are applied by the browser before the page finishes rendering, eliminating
most "flash of unwanted content". JavaScript is needed for dynamic behaviour (YouTube
is a single-page app that re-renders without full page reloads, so a MutationObserver
is required to re-apply rules as the DOM changes).

---

## Modes

The extension supports two homepage modes, toggled via the popup UI and persisted
in `chrome.storage.sync` under the key `ydlMode`.

### Basic (default)

Behaviour identical to the original extension:
- The entire homepage feed is hidden via CSS (`body.ydl-home` class)
- A MutationObserver watches for the Subscriptions chip and clicks it immediately
- If the chip is not found within 2 seconds, the user is redirected to
  `youtube.com/feed/subscriptions`

### Advanced

Keeps the homepage feed visible but filters it to only show videos from subscribed channels:
- The body class becomes `ydl-home-advanced` instead of `ydl-home`, leaving the
  feed visible (CSS explicitly sets `display: block !important` for this class)
- On page load, the extension scrapes subscribed channel hrefs from the left sidebar's
  "Subscriptions" section (`ytd-guide-section-renderer`)
- Each homepage video card (`ytd-rich-item-renderer`) is shown or hidden based on
  whether its channel href appears in the scraped subscription set
- A MutationObserver on the grid container keeps newly-loaded cards (infinite scroll)
  filtered in real time
- A second MutationObserver watches for the sidebar to load if it is not yet in the
  DOM when the page is first displayed

**Limitation**: YouTube's sidebar shows a capped list of subscriptions (typically 7–10)
followed by a "Show N more" button. The scraper only sees visible entries. Expanding
the sidebar manually before navigating to the homepage ensures all subscriptions
are included.

---

## Feature Breakdown

### 1. Remove Shorts

**Where Shorts appear:**
- Homepage shelf labelled "Shorts"
- Search results Shorts shelf
- Sidebar "Shorts" link in the left nav
- The `/shorts/` URL path itself (redirect to homepage)
- Shorts mixed into subscription feed

**Approach:**
- CSS: target known Shorts shelf selectors and the nav link
- JS: MutationObserver watches for dynamically injected Shorts shelves and removes them
- JS: If `window.location.pathname` starts with `/shorts/`, redirect to `youtube.com/`

---

### 2. Watch Page — Hide Recommendations, Keep Comments

**Where recommendations appear on the watch page:**
- Right-hand sidebar (`#secondary`) containing "Up Next" and autoplay queue

**What to keep:**
- The video player
- The video title and metadata (likes, views, channel info)
- The comments section (`#comments`)

**Approach:**
- CSS: `#secondary { display: none !important; }` when on a `/watch` URL, but only when
  no `ytd-live-chat-frame` is present (detected via `:has()`) — this preserves live chat
  on livestreams while still hiding recommendations on regular videos
- JS: MutationObserver detects SPA navigation to `/watch` pages and toggles the rule

---

### 3. Homepage — Basic Mode

**Approach:**
- CSS: hide the main homepage feed container when `body.ydl-home` is present
- JS: MutationObserver watches for the Subscriptions chip and clicks it immediately
- JS: if the chip is not found within 2 seconds, redirect to `youtube.com/feed/subscriptions`

---

### 4. Homepage — Advanced Mode

**Approach:**
- `applyPageClass` adds `body.ydl-home-advanced` instead of `body.ydl-home`
- CSS keeps the feed visible (`display: block !important`)
- JS scrapes subscribed channel hrefs from the sidebar's Subscriptions section
- JS filters `ytd-rich-item-renderer` cards by comparing `ytd-channel-name a[href]`
  against the scraped set (normalized: lowercase, no trailing slash, no query string)
- Cards from unsubscribed channels get `style.display = 'none'` (not removed, to avoid
  breaking YouTube's virtual-list scroll bookkeeping)
- Two MutationObservers run: one for sidebar loading, one for infinite-scroll new cards

---

## Live Mode Switching

When the user changes modes in the popup:
1. The popup writes the new value to `chrome.storage.sync`
2. The popup sends a `{ type: 'YDL_SET_MODE', mode }` message to every open YouTube tab
3. The content script's `chrome.runtime.onMessage` listener receives the message,
   updates `currentMode`, and calls `applyPageClass` + `activateHomepageMode`

No tab reload is required. The body class swap and observer teardown/startup happen
synchronously in response to the message.

---

## Page Detection (SPA Navigation)

YouTube uses the History API for navigation. To handle in-app navigation the extension:

1. Listens to `yt-navigate-finish` (a custom event YouTube dispatches after each navigation)
2. Falls back to a `MutationObserver` on `document.title` (changes on every navigation)

---

## CSS Selector Strategy

YouTube's generated class names change frequently. The extension prefers:
- Stable element IDs (`#secondary`, `#comments`, `#primary`)
- Tag + attribute selectors (`ytd-reel-shelf-renderer`, `ytd-rich-shelf-renderer[is-shorts]`)
- `aria-label` attributes where available

---

## Permissions Required

| Permission | Reason |
|---|---|
| `activeTab` | Read and modify the current YouTube tab |
| `scripting` | Inject the content script |
| `storage` | Persist the selected mode (`ydlMode`) across sessions |
| Host permission: `*://*.youtube.com/*` | Run on all YouTube pages |

No user data is collected. No network requests are made by the extension.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YouTube changes DOM selectors | Use stable IDs; maintain a selector update list |
| SPA navigation not detected | Dual detection: `yt-navigate-finish` + title MutationObserver |
| Subscriptions chip not found within 2 s (basic) | Redirect to `youtube.com/feed/subscriptions` |
| Sidebar not loaded when page opens (advanced) | MutationObserver waits for sidebar section |
| Flash of hidden content | CSS injected via `styles.css` loads before JS |
| Sidebar shows only partial subscription list | Documented limitation; user can expand sidebar manually |
| Channel href format mismatch (`/@handle` vs `/channel/UCxxx`) | Normalized comparison; edge-case if YouTube uses inconsistent formats |

---

## Future Considerations

- Show a count of filtered-out cards in the popup (advanced mode)
- Option to force-expand the sidebar "Show more" list automatically (advanced mode)
- Firefox port (Manifest V2/V3 compatibility layer)
