'use strict';

// ─── Mode state ───────────────────────────────────────────────────────────────
// Persisted in chrome.storage.sync as { ydlMode: 'basic' | 'advanced' }.
// Default is 'basic' (current behaviour).

let currentMode = 'basic';

// ─── Page-type body classes ───────────────────────────────────────────────────
// CSS rules in styles.css are gated on these classes so they only apply on the
// right page. In advanced mode the homepage gets 'ydl-home-advanced' instead of
// 'ydl-home', which keeps the feed visible so JS can filter individual cards.

function applyPageClass() {
  const path = window.location.pathname;
  document.body.classList.remove('ydl-watch', 'ydl-home', 'ydl-home-advanced');

  if (path === '/' || path === '/feed/trending') {
    document.body.classList.add(currentMode === 'advanced' ? 'ydl-home-advanced' : 'ydl-home');
  } else if (path.startsWith('/watch')) {
    document.body.classList.add('ydl-watch');
  } else if (path.startsWith('/shorts/')) {
    window.location.replace('https://www.youtube.com/');
    return;
  }
}

// ─── Shorts shelf pruning (dynamic / injected shelves) ───────────────────────

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
      if (node.matches(SHORTS_SELECTORS)) node.remove();
      else removeShortsShelves(node);
    }
  }
});

function startShelvesObserver() {
  shelvesObserver.observe(document.body, { childList: true, subtree: true });
}

// ─── Basic mode: click the Subscriptions chip ─────────────────────────────────
// After landing on the homepage we try to activate the Subscriptions feed chip
// so the user sees channels they follow instead of the algorithm feed.

function findAndClickSubscriptionsChip() {
  const chips = document.querySelectorAll(
    'yt-chip-cloud-chip-renderer, iron-selector yt-formatted-string'
  );
  for (const chip of chips) {
    if (chip.textContent.trim().toLowerCase() === 'subscriptions') {
      chip.click();
      return true;
    }
  }
  return false;
}

function activateSubscriptionsChip() {
  if (!document.body.classList.contains('ydl-home')) return;
  if (findAndClickSubscriptionsChip()) return;

  const obs = new MutationObserver(() => {
    if (findAndClickSubscriptionsChip()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // If chip not found after 2 s, redirect to the full subscriptions page.
  setTimeout(() => {
    obs.disconnect();
    if (document.body.classList.contains('ydl-home')) {
      window.location.replace('https://www.youtube.com/feed/subscriptions');
    }
  }, 2000);
}

// ─── Advanced mode: subscription scraper + feed filter ───────────────────────
// Reads subscribed channel hrefs from the left sidebar's "Subscriptions" section
// and hides homepage video cards whose channel is not in that set.
//
// Note: YouTube's sidebar shows a capped list of subscriptions (typically 7–10)
// followed by a "Show N more" button. The scraper only sees visible entries. If
// you want all subscriptions to be included, expand the sidebar manually before
// navigating to the homepage.

let sidebarObserver = null;
let cardObserver    = null;
let cachedSubHrefs  = null; // Set<string> once populated, null until then

function normalizeHref(href) {
  // Strip query string, hash, and trailing slash for consistent comparison.
  return href.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase();
}

function scrapeSubscriptionHrefs() {
  const sections = document.querySelectorAll('ytd-guide-section-renderer');
  for (const section of sections) {
    // YouTube uses different heading elements in different versions of its UI.
    const heading = section.querySelector(
      '#section-title, ytd-guide-collapsible-section-entry-renderer #section-entry-title, h3'
    );
    if (!heading) continue;
    if (!heading.textContent.trim().toLowerCase().includes('subscriptions')) continue;

    const hrefs = new Set();
    section.querySelectorAll('ytd-guide-entry-renderer a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (href && href !== '/') hrefs.add(normalizeHref(href));
    });
    return hrefs; // may be an empty Set if the section hasn't hydrated yet
  }
  return null; // section not yet in the DOM
}

function shouldKeepCard(card, subHrefs) {
  const channelLink = card.querySelector('ytd-channel-name a[href]');
  // If we can't determine the channel (e.g. mix/playlist cards), keep it to
  // avoid incorrectly hiding content the user should see.
  if (!channelLink) return true;
  const href = channelLink.getAttribute('href');
  if (!href) return true;
  return subHrefs.has(normalizeHref(href));
}

function filterFeedCards(subHrefs) {
  document.querySelectorAll('ytd-rich-item-renderer').forEach(card => {
    // Use display:none rather than remove() so YouTube's internal virtual-list
    // bookkeeping is not disturbed (which would break infinite scroll).
    card.style.display = shouldKeepCard(card, subHrefs) ? '' : 'none';
  });
}

function stopAdvancedObservers() {
  if (sidebarObserver) { sidebarObserver.disconnect(); sidebarObserver = null; }
  if (cardObserver)    { cardObserver.disconnect();    cardObserver = null; }
  cachedSubHrefs = null;
  // Restore any cards that were hidden so switching back to basic mode doesn't
  // leave phantom hidden cards before the CSS rule takes over.
  document.querySelectorAll('ytd-rich-item-renderer').forEach(card => {
    card.style.display = '';
  });
}

function startCardObserver() {
  // Observe the grid container for newly injected cards (infinite scroll).
  const grid = document.querySelector('ytd-rich-grid-renderer');
  if (!grid) return;
  cardObserver = new MutationObserver(mutations => {
    if (!cachedSubHrefs) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('ytd-rich-item-renderer')) {
          node.style.display = shouldKeepCard(node, cachedSubHrefs) ? '' : 'none';
        } else {
          node.querySelectorAll('ytd-rich-item-renderer').forEach(card => {
            card.style.display = shouldKeepCard(card, cachedSubHrefs) ? '' : 'none';
          });
        }
      }
    }
  });
  cardObserver.observe(grid, { childList: true, subtree: true });
}

function startAdvancedMode() {
  stopAdvancedObservers();

  // Try to scrape the sidebar immediately — it may already be in the DOM.
  const hrefs = scrapeSubscriptionHrefs();
  if (hrefs && hrefs.size > 0) {
    cachedSubHrefs = hrefs;
    filterFeedCards(hrefs);
    startCardObserver();
    return;
  }

  // Sidebar not loaded yet — watch for it and filter once it appears.
  sidebarObserver = new MutationObserver(() => {
    const hrefs = scrapeSubscriptionHrefs();
    if (!hrefs || hrefs.size === 0) return;
    sidebarObserver.disconnect();
    sidebarObserver = null;
    cachedSubHrefs = hrefs;
    filterFeedCards(hrefs);
    startCardObserver();
  });
  sidebarObserver.observe(document.body, { childList: true, subtree: true });
}

// ─── Homepage mode dispatcher ─────────────────────────────────────────────────

function activateHomepageMode() {
  const isHome = document.body.classList.contains('ydl-home') ||
                 document.body.classList.contains('ydl-home-advanced');
  if (!isHome) {
    stopAdvancedObservers();
    return;
  }
  if (currentMode === 'advanced') {
    startAdvancedMode();
  } else {
    stopAdvancedObservers();
    activateSubscriptionsChip();
  }
}

// ─── Message listener (live mode switching from popup) ────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'YDL_SET_MODE') return;
  currentMode = msg.mode;
  applyPageClass();
  activateHomepageMode();
});

// ─── SPA navigation detection ─────────────────────────────────────────────────
// YouTube never does full page reloads — listen for its custom navigation event
// and fall back to watching the document title change.

function onNavigate() {
  applyPageClass();
  removeShortsShelves();
  activateHomepageMode();
}

window.addEventListener('yt-navigate-finish', onNavigate);

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
// Load mode from storage before applying any page logic so the correct body
// class is set from the start.

function init() {
  chrome.storage.sync.get('ydlMode', ({ ydlMode = 'basic' }) => {
    currentMode = ydlMode;
    applyPageClass();
    removeShortsShelves();
    startShelvesObserver();
    activateHomepageMode();
  });
}

// document_start means the body may not exist yet — wait for it.
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
