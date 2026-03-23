# YouTube Distraction Remover

A browser extension that removes distracting content from YouTube:

- Removes all YouTube Shorts (shelves, nav link, and redirects `/shorts/` URLs)
- On the watch page, hides the recommendations sidebar — only the video and comments remain
- On the homepage, hides the algorithmic feed and switches to your Subscriptions feed

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

- You must be logged in to YouTube for the Subscriptions feed to appear on the homepage
- If YouTube updates its layout, some selectors may need updating — see `styles.css` and `content.js`
