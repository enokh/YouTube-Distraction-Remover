'use strict';

// ─── Page-type body classes ───────────────────────────────────────────────────
// CSS rules in styles.css are gated on these classes so they only apply on the
// right page, even though the content script loads on all youtube.com URLs.

function applyPageClass() {
  const path = window.location.pathname;

  document.body.classList.remove('ydl-watch', 'ydl-home');

  if (path === '/' || path === '/feed/trending') {
    document.body.classList.add('ydl-home');
  } else if (path.startsWith('/watch')) {
    document.body.classList.add('ydl-watch');
  } else if (path.startsWith('/shorts/')) {
    // Redirect Shorts URLs back to the homepage
    window.location.replace('https://www.youtube.com/');
    return;
  }
}

// ─── Homepage: click the Subscriptions chip ──────────────────────────────────
// After landing on the homepage we try to activate the Subscriptions feed chip
// so the user sees channels they follow instead of the algorithm feed.

function activateSubscriptionsChip() {
  if (!document.body.classList.contains('ydl-home')) return;

  // Chips take a moment to render — poll briefly then give up
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;

    const chips = document.querySelectorAll(
      'yt-chip-cloud-chip-renderer, iron-selector yt-formatted-string'
    );

    for (const chip of chips) {
      if (chip.textContent.trim().toLowerCase() === 'subscriptions') {
        chip.click();
        clearInterval(interval);
        return;
      }
    }

    if (attempts >= 20) clearInterval(interval); // give up after ~2 s
  }, 100);
}

// ─── Shorts shelf pruning (dynamic / injected shelves) ───────────────────────
// CSS covers static shelves. This MutationObserver catches shelves injected
// after initial load (infinite scroll, SPA navigation).

const SHORTS_SELECTORS = [
  'ytd-reel-shelf-renderer',
  'ytd-rich-shelf-renderer[is-shorts]',
].join(',');

function removeShortsShelves(root = document) {
  root.querySelectorAll(SHORTS_SELECTORS).forEach(el => el.remove());
}

const shelvesObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches(SHORTS_SELECTORS)) {
        node.remove();
      } else {
        removeShortsShelves(node);
      }
    }
  }
});

function startShelvesObserver() {
  shelvesObserver.observe(document.body, { childList: true, subtree: true });
}

// ─── SPA navigation detection ─────────────────────────────────────────────────
// YouTube never does full page reloads — listen for its custom navigation event
// and fall back to watching the document title change.

function onNavigate() {
  applyPageClass();
  removeShortsShelves();
  activateSubscriptionsChip();
}

// YouTube fires this after every in-app navigation
window.addEventListener('yt-navigate-finish', onNavigate);

// Fallback: watch for title changes (covers edge cases)
let lastTitle = document.title;
new MutationObserver(() => {
  if (document.title !== lastTitle) {
    lastTitle = document.title;
    onNavigate();
  }
}).observe(document.querySelector('head > title') ?? document.head, {
  subtree: true,
  characterData: true,
  childList: true,
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

function init() {
  applyPageClass();
  removeShortsShelves();
  startShelvesObserver();
  activateSubscriptionsChip();
}

// document_start means the body may not exist yet — wait for it
if (document.body) {
  init();
} else {
  new MutationObserver((_, obs) => {
    if (document.body) {
      obs.disconnect();
      init();
    }
  }).observe(document.documentElement, { childList: true });
}
