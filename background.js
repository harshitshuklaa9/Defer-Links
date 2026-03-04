/**
 * Defer – Service Worker (background.js)
 * Sets up the "Park for Later" context menu, resolves link titles via the
 * content script, and persists parked links to chrome.storage.local.
 */

// ---------------------------------------------------------------------------
// Installation – context menu + default storage
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "park-link",
    title: "Park for Later",
    contexts: ["link"],
  });
  console.log("Defer: context menu registered");

  chrome.storage.local.get(["parkedLinks", "settings"], (result) => {
    if (!result.parkedLinks) {
      chrome.storage.local.set({ parkedLinks: [] });
    }
    if (!result.settings) {
      chrome.storage.local.set({
        settings: { defaultGroup: "Uncategorized", showSnoozed: false },
      });
    }
    console.log("Defer: storage initialised");
  });
});

// ---------------------------------------------------------------------------
// Context-menu click handler
// ---------------------------------------------------------------------------
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "park-link") return;

  console.log("Defer: parking link", info.linkUrl);

  const title = await resolveTitle(info, tab);
  const faviconUrl = buildFaviconUrl(info.linkUrl);
  const { settings } = await chrome.storage.local.get("settings");
  const defaultGroup = settings?.defaultGroup || "Uncategorized";

  const newLink = {
    id: crypto.randomUUID(),
    url: info.linkUrl,
    title,
    faviconUrl,
    group: defaultGroup,
    createdAt: Date.now(),
    snoozeUntil: null,
  };

  const { parkedLinks = [] } = await chrome.storage.local.get("parkedLinks");
  parkedLinks.push(newLink);
  await chrome.storage.local.set({ parkedLinks });
  console.log("Defer: saved –", newLink.title);

  // Brief visual confirmation on the toolbar icon
  try {
    chrome.action.setBadgeText({ text: "+", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#4ec9b0", tabId: tab.id });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "", tabId: tab.id }).catch(() => {});
    }, 1500);
  } catch {
    // Tab may have closed – non-critical
  }
});

// ---------------------------------------------------------------------------
// Title resolution – content script → executeScript → URL fallback
// ---------------------------------------------------------------------------
async function resolveTitle(info, tab) {
  // Strategy 1: ask the content script for cached link text
  try {
    const response = await chrome.tabs.sendMessage(
      tab.id,
      { type: "GET_LINK_TEXT", linkUrl: info.linkUrl },
      { frameId: info.frameId }
    );
    if (response?.title) {
      console.log("Defer: title from content script");
      return response.title;
    }
  } catch (err) {
    console.warn("Defer: content script unreachable –", err.message);
  }

  // Strategy 2: inject a one-shot script to find the anchor by href
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId] },
      func: (linkUrl) => {
        for (const a of document.querySelectorAll("a")) {
          if (a.href === linkUrl) {
            const t = a.textContent.trim().replace(/\s+/g, " ");
            if (t) return t.substring(0, 200);
          }
        }
        return null;
      },
      args: [info.linkUrl],
    });
    if (results?.[0]?.result) {
      console.log("Defer: title from executeScript fallback");
      return results[0].result;
    }
  } catch (err) {
    console.warn("Defer: executeScript fallback failed –", err.message);
  }

  // Strategy 3: derive from URL
  console.log("Defer: using URL-based fallback title");
  return titleFromUrl(info.linkUrl);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return u.hostname + path;
  } catch {
    return url;
  }
}

function buildFaviconUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return "";
  }
}
