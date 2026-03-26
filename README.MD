# YouTube Distraction Remover

A browser extension that removes distracting content from YouTube:

- Removes all YouTube Shorts (shelves, nav link, and redirects `/shorts/` URLs)
- On the watch page, hides the recommendations sidebar — only the video and comments remain (live chat is preserved on livestreams)
- On the homepage, offers two modes for controlling what you see (see below)

---

## Modes

Click the extension icon in your browser toolbar to switch between modes.

### Basic (default)

Hides the entire algorithmic homepage feed and redirects you to your Subscriptions feed.
This is the most aggressive option — you only see videos from channels you follow,
in chronological order.

### Advanced

Keeps the homepage feed but filters it in real time to only show videos from channels
you are subscribed to. You still get YouTube's algorithmic ordering, but limited to
your own subscriptions instead of the full recommendation engine.

**Note:** The extension reads your subscription list from the left sidebar. YouTube
shows a limited number of subscriptions there by default. To include all your
subscriptions, expand the sidebar's "Show more" section before visiting the homepage.

---

## Installation — Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `no_shorts_extension` folder
5. Navigate to YouTube — the extension is active immediately

## Installation — Edge

1. Go to `edge://extensions`
2. Enable **Developer mode** (toggle in the left sidebar)
3. Click **Load unpacked**
4. Select the `no_shorts_extension` folder
5. Navigate to YouTube — the extension is active immediately

---

## Notes

- You must be logged in to YouTube for the Subscriptions feed and subscription list to be available
- Switching modes takes effect immediately on open YouTube tabs — no reload required
- If YouTube updates its layout, some selectors may need updating — see `styles.css` and `content.js`
