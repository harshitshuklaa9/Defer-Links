/**
 * Defer – Content Script
 * Captures the visible text of right-clicked links and relays it to the
 * service worker so parked links get human-readable titles.
 */

(() => {
  "use strict";

  let lastRightClickedLink = { text: null, href: null };

  // Capture link text the instant the context menu fires, before Chrome
  // shows it. useCapture=true so page scripts cannot stopPropagation first.
  document.addEventListener(
    "contextmenu",
    (event) => {
      const anchor = event.target.closest("a");
      if (anchor && anchor.href) {
        // Use innerText (respects CSS visibility) to avoid hidden duplicates.
        // Take only the first 8 words to keep titles clean and avoid
        // duplication artifacts from sites like LinkedIn.
        const title = (anchor.innerText || anchor.textContent || "")
          .trim()
          .replace(/\s+/g, " ")
          .split(" ")
          .slice(0, 8)
          .join(" ");
        lastRightClickedLink = {
          text: title,
          href: anchor.href,
        };
      } else {
        lastRightClickedLink = { text: null, href: null };
      }
    },
    true
  );

  // Respond to background asking for the cached link text.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_LINK_TEXT") {
      if (
        lastRightClickedLink.href === message.linkUrl &&
        lastRightClickedLink.text
      ) {
        sendResponse({ title: lastRightClickedLink.text });
      } else {
        sendResponse({ title: null });
      }
    }
    // synchronous sendResponse – no need to return true
    return false;
  });
})();
