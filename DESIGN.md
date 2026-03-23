# YouTube Distraction Remover — Design Document

## Overview

A Chrome browser extension (Manifest V3) that removes distracting content from YouTube,
helping the user focus on content from channels they have chosen to follow.

---

## Goals

1. Remove all YouTube Shorts from every surface (shelves, sidebar, dedicated page)
2. On the watch page, hide the recommendations sidebar — show only the video and comments
3. On the homepage, hide all recommended videos and nudge the user toward the Subscriptions feed

---

## Non-Goals

- Will not filter recommendations using the YouTube Data API or OAuth
- Will not modify YouTube's recommendation algorithm
- Will not block ads (separate concern, separate tooling)
- Firefox / Safari support (can be added later; focus is Chrome for now)

---

## Architecture

```
no_shorts_extension/
├── manifest.json       # Extension metadata and permissions (Manifest V3)
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
- JS: MutationObserver watches for dynamically injected Shorts shelves and hides them
- JS: If `window.location.pathname` starts with `/shorts/`, redirect to `youtube.com/`

---

### 2. Watch Page — Hide Recommendations, Keep Comments

**Where recommendations appear on the watch page:**
- Right-hand sidebar (`#secondary`) containing "Up Next" and autoplay queue

**What to keep:**
- The video player (`#primary > ytd-watch-flexy`)
- The video title and metadata (likes, views, channel info)
- The comments section (`#comments`)

**Approach:**
- CSS: `#secondary { display: none !important; }` when on a `/watch` URL
- JS: MutationObserver detects navigation to `/watch` pages (YouTube SPA navigation
  does not trigger full page reloads) and toggles the rule dynamically

---

### 3. Homepage — Hide Recommendations, Surface Subscriptions

**What appears on the homepage (`youtube.com/`):**
- Algorithmically recommended videos (the default feed)
- A "Subscriptions" chip in the top filter bar

**Approach:**
- CSS: hide the main homepage feed container on `youtube.com/`
- JS: a `MutationObserver` watches for the Subscriptions chip and clicks it the
  instant it appears in the DOM — no fixed delay
- JS: if the chip has not been found within 2 seconds (e.g. slow load or logged-out),
  the observer is cancelled and the user is redirected to
  `youtube.com/feed/subscriptions` as a fallback

---

## Page Detection (SPA Navigation)

YouTube uses the History API for navigation. A standard `DOMContentLoaded` listener
only fires on hard loads. To handle in-app navigation the extension will:

1. Listen to `yt-navigate-finish` (a custom event YouTube dispatches after each navigation)
2. As a fallback, use a `MutationObserver` on `document.title` (changes on every navigation)

This ensures all rules are re-evaluated whenever the user moves between pages.

---

## CSS Selector Strategy

YouTube's generated class names change frequently. The extension will prefer:
- Stable element IDs (`#secondary`, `#comments`, `#primary`)
- Tag + attribute selectors (`ytd-reel-shelf-renderer`, `ytd-rich-shelf-renderer`)
- `aria-label` attributes where available

This makes the extension more resilient to YouTube's UI updates.

---

## Permissions Required

| Permission | Reason |
|---|---|
| `activeTab` | Read and modify the current YouTube tab |
| `scripting` | Inject the content script |
| Host permission: `*://*.youtube.com/*` | Run on all YouTube pages |

No user data is collected. No network requests are made by the extension.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| YouTube changes DOM selectors | Use stable IDs; maintain a selector update list |
| SPA navigation not detected | Dual detection: `yt-navigate-finish` + title MutationObserver |
| Subscriptions chip not found within 2 s | Redirect to `youtube.com/feed/subscriptions` |
| Flash of hidden content | CSS injected via `styles.css` loads before JS |

---

## Future Considerations

- Option to whitelist specific channels on the homepage (requires YouTube Data API + OAuth)
- Firefox port (Manifest V2/V3 compatibility layer)
- Extension popup UI for toggling individual features on/off
