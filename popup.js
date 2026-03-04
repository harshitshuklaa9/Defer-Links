/**
 * Defer – popup.js
 * Renders the parked-links list, handles filtering, selection, snooze,
 * group changes, open/delete actions, and settings.
 */

(() => {
  "use strict";

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const GROUPS = [
    "All",
    "Research",
    "Shopping",
    "Reading",
    "Jobs",
    "Uncategorized",
  ];

  const SNOOZE_OPTIONS = [
    { label: "1 hour", ms: 60 * 60 * 1000 },
    { label: "1 day", ms: 24 * 60 * 60 * 1000 },
    { label: "1 week", ms: 7 * 24 * 60 * 60 * 1000 },
  ];

  const GROUP_VALUES = GROUPS.slice(1); // without "All"

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let parkedLinks = [];
  let settings = { defaultGroup: "Uncategorized", showSnoozed: false };
  let currentTab = "All";
  let selectedIds = new Set();

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------
  const $tabs = document.getElementById("tabs");
  const $list = document.getElementById("link-list");
  const $selectAll = document.getElementById("select-all");
  const $openSelected = document.getElementById("open-selected");
  const $showSnoozed = document.getElementById("show-snoozed"); // may be null if removed from HTML
  const $defaultGroup = document.getElementById("default-group");

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await loadData();
    renderTabs();
    renderList();
    wireEvents();
  });

  async function loadData() {
    const result = await chrome.storage.local.get(["parkedLinks", "settings"]);
    parkedLinks = result.parkedLinks || [];
    settings = result.settings || {
      defaultGroup: "Uncategorized",
      showSnoozed: false,
    };
    if ($showSnoozed) $showSnoozed.checked = settings.showSnoozed;
    $defaultGroup.value = settings.defaultGroup;
  }

  // -----------------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------------
  function renderTabs() {
    $tabs.innerHTML = "";
    const now = Date.now();

    for (const group of GROUPS) {
      const btn = document.createElement("button");
      btn.className = "tab" + (group === currentTab ? " active" : "");
      const count = countForGroup(group, now);
      btn.innerHTML =
        escHtml(group) +
        (count > 0 ? ` <span class="count">${count}</span>` : "");
      btn.addEventListener("click", () => {
        currentTab = group;
        selectedIds.clear();
        $selectAll.checked = false;
        renderTabs();
        renderList();
      });
      $tabs.appendChild(btn);
    }
  }

  function countForGroup(group, now) {
    return parkedLinks.filter((l) => {
      const inGroup = group === "All" || l.group === group;
      const visible =
        !l.snoozeUntil || l.snoozeUntil <= now || settings.showSnoozed;
      return inGroup && visible;
    }).length;
  }

  // -----------------------------------------------------------------------
  // List rendering
  // -----------------------------------------------------------------------
  function renderList() {
    $list.innerHTML = "";
    const now = Date.now();

    const filtered = parkedLinks.filter(
      (l) => currentTab === "All" || l.group === currentTab
    );

    const active = filtered.filter(
      (l) => !l.snoozeUntil || l.snoozeUntil <= now
    );
    const snoozed = filtered.filter(
      (l) => l.snoozeUntil && l.snoozeUntil > now
    );

    if (active.length === 0 && (!settings.showSnoozed || snoozed.length === 0)) {
      $list.innerHTML =
        '<li class="empty-state"><span>&#128278;</span>No parked links yet.<br>Right-click a link &rarr; Park for Later</li>';
      updateOpenSelectedBtn();
      return;
    }

    // Render active links (newest first)
    for (const link of active.sort((a, b) => b.createdAt - a.createdAt)) {
      $list.appendChild(buildRow(link, false, now));
    }

    // Render snoozed links if toggled on
    if (settings.showSnoozed && snoozed.length > 0) {
      for (const link of snoozed.sort((a, b) => a.snoozeUntil - b.snoozeUntil)) {
        $list.appendChild(buildRow(link, true, now));
      }
    }

    updateOpenSelectedBtn();
  }

  function buildRow(link, isSnoozed, now) {
    const li = document.createElement("li");
    li.className = "link-row" + (isSnoozed ? " snoozed" : "");
    li.dataset.id = link.id;

    // Checkbox
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedIds.has(link.id);
    cb.addEventListener("change", () => {
      if (cb.checked) selectedIds.add(link.id);
      else selectedIds.delete(link.id);
      syncSelectAll();
      updateOpenSelectedBtn();
    });

    // Favicon
    let faviconEl;
    if (link.faviconUrl) {
      faviconEl = document.createElement("img");
      faviconEl.className = "link-favicon";
      faviconEl.src = link.faviconUrl;
      faviconEl.alt = "";
      faviconEl.onerror = () => {
        const ph = document.createElement("span");
        ph.className = "favicon-placeholder";
        ph.textContent = "?";
        faviconEl.replaceWith(ph);
      };
    } else {
      faviconEl = document.createElement("span");
      faviconEl.className = "favicon-placeholder";
      faviconEl.textContent = "?";
    }

    // Info block
    const info = document.createElement("div");
    info.className = "link-info";

    const titleEl = document.createElement("div");
    titleEl.className = "link-title";
    titleEl.textContent = link.title;
    titleEl.title = link.title;

    const urlEl = document.createElement("div");
    urlEl.className = "link-url";
    urlEl.textContent = link.url;
    urlEl.title = link.url;

    info.appendChild(titleEl);
    info.appendChild(urlEl);

    // Time + group label
    const timeEl = document.createElement("span");
    timeEl.className = "link-time";
    if (isSnoozed) {
      const badge = document.createElement("span");
      badge.className = "snooze-badge";
      badge.textContent = formatRemaining(link.snoozeUntil - now);
      timeEl.appendChild(badge);
    } else {
      timeEl.appendChild(document.createTextNode(formatRelative(now - link.createdAt)));
    }
    // Group label — plain text, muted
    const groupLabel = document.createElement("span");
    groupLabel.className = "link-group";
    groupLabel.textContent = " · " + link.group;
    timeEl.appendChild(groupLabel);

    // Actions — Open button + × delete icon
    const actions = document.createElement("div");
    actions.className = "link-actions";

    // Open
    const btnOpen = document.createElement("button");
    btnOpen.className = "btn-open";
    btnOpen.textContent = "Open";
    btnOpen.title = "Open in new tab";
    btnOpen.addEventListener("click", () => openLink(link));

    // Delete — small red pill button
    const btnDel = document.createElement("button");
    btnDel.className = "btn-del";
    btnDel.textContent = "Del";
    btnDel.title = "Delete";
    btnDel.addEventListener("click", () => deleteLink(link.id));

    actions.append(btnOpen, btnDel);

    li.append(cb, faviconEl, info, timeEl, actions);
    return li;
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  function openLink(link) {
    chrome.tabs.create({ url: link.url, active: false });
  }

  async function openSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    for (const id of ids) {
      const link = parkedLinks.find((l) => l.id === id);
      if (link) chrome.tabs.create({ url: link.url, active: false });
    }
    selectedIds.clear();
    $selectAll.checked = false;
    renderList();
  }

  async function deleteLink(id) {
    parkedLinks = parkedLinks.filter((l) => l.id !== id);
    selectedIds.delete(id);
    await save();
    renderTabs();
    renderList();
  }

  async function changeGroup(id, group) {
    const link = parkedLinks.find((l) => l.id === id);
    if (link) {
      link.group = group;
      await save();
      renderTabs();
      // re-render only if filtered view would hide it
      if (currentTab !== "All" && currentTab !== group) {
        renderList();
      }
    }
  }

  async function snoozeLink(id, ms) {
    const link = parkedLinks.find((l) => l.id === id);
    if (link) {
      link.snoozeUntil = Date.now() + ms;
      await save();
      renderTabs();
      renderList();
    }
  }

  async function unsnooze(id) {
    const link = parkedLinks.find((l) => l.id === id);
    if (link) {
      link.snoozeUntil = null;
      await save();
      renderTabs();
      renderList();
    }
  }

  // -----------------------------------------------------------------------
  // Snooze menu
  // -----------------------------------------------------------------------
  function showSnoozeMenu(anchor, linkId) {
    closeSnoozeMenu();
    const menu = document.createElement("div");
    menu.className = "snooze-menu";
    menu.id = "snooze-menu-active";

    for (const opt of SNOOZE_OPTIONS) {
      const btn = document.createElement("button");
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        closeSnoozeMenu();
        snoozeLink(linkId, opt.ms);
      });
      menu.appendChild(btn);
    }

    // Position near the anchor
    const rect = anchor.getBoundingClientRect();
    menu.style.top = rect.bottom + 2 + "px";
    menu.style.right = document.body.clientWidth - rect.right + "px";

    document.body.appendChild(menu);

    // Close on outside click (next tick)
    setTimeout(() => {
      document.addEventListener("click", onOutsideClick);
    }, 0);
  }

  function closeSnoozeMenu() {
    const existing = document.getElementById("snooze-menu-active");
    if (existing) existing.remove();
    document.removeEventListener("click", onOutsideClick);
  }

  function onOutsideClick(e) {
    const menu = document.getElementById("snooze-menu-active");
    if (menu && !menu.contains(e.target)) {
      closeSnoozeMenu();
    }
  }

  // -----------------------------------------------------------------------
  // Selection helpers
  // -----------------------------------------------------------------------
  function syncSelectAll() {
    const boxes = $list.querySelectorAll('input[type="checkbox"]');
    if (boxes.length === 0) {
      $selectAll.checked = false;
      return;
    }
    $selectAll.checked = [...boxes].every((cb) => cb.checked);
  }

  function updateOpenSelectedBtn() {
    $openSelected.disabled = selectedIds.size === 0;
    $openSelected.textContent =
      selectedIds.size > 0
        ? `Open Selected (${selectedIds.size})`
        : "Open Selected";
  }

  // -----------------------------------------------------------------------
  // Event wiring
  // -----------------------------------------------------------------------
  function wireEvents() {
    // Select All
    $selectAll.addEventListener("change", () => {
      const boxes = $list.querySelectorAll('input[type="checkbox"]');
      for (const cb of boxes) {
        cb.checked = $selectAll.checked;
        const id = cb.closest(".link-row")?.dataset.id;
        if (id) {
          if ($selectAll.checked) selectedIds.add(id);
          else selectedIds.delete(id);
        }
      }
      updateOpenSelectedBtn();
    });

    // Open Selected
    $openSelected.addEventListener("click", openSelected);

    // Show Snoozed toggle (if present in HTML)
    if ($showSnoozed) {
      $showSnoozed.addEventListener("change", async () => {
        settings.showSnoozed = $showSnoozed.checked;
        await chrome.storage.local.set({ settings });
        renderTabs();
        renderList();
      });
    }

    // Default group
    $defaultGroup.addEventListener("change", async () => {
      settings.defaultGroup = $defaultGroup.value;
      await chrome.storage.local.set({ settings });
      console.log("Defer: default group →", settings.defaultGroup);
    });

    // Live update when background saves while popup is open
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.parkedLinks) {
        parkedLinks = changes.parkedLinks.newValue || [];
        renderTabs();
        renderList();
      }
      if (changes.settings) {
        settings = changes.settings.newValue || settings;
        if ($showSnoozed) $showSnoozed.checked = settings.showSnoozed;
        $defaultGroup.value = settings.defaultGroup;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Storage helper
  // -----------------------------------------------------------------------
  async function save() {
    await chrome.storage.local.set({ parkedLinks });
  }

  // -----------------------------------------------------------------------
  // Formatting helpers
  // -----------------------------------------------------------------------
  function formatRelative(ms) {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return min + "m ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    const days = Math.floor(hr / 24);
    if (days < 30) return days + "d ago";
    const months = Math.floor(days / 30);
    return months + "mo ago";
  }

  function formatRemaining(ms) {
    if (ms <= 0) return "ready";
    const min = Math.floor(ms / 60000);
    if (min < 60) return min + "m left";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h left";
    const days = Math.floor(hr / 24);
    return days + "d left";
  }

  function escHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }
})();

// -------------------------------------------------------------------------
// Stats updater — reads from storage and updates the stat counters.
// (Moved from inline <script> in sidepanel.html for MV3 CSP compliance.)
// -------------------------------------------------------------------------
function updateStats() {
  chrome.storage.local.get("parkedLinks", (result) => {
    const links = result.parkedLinks || [];
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    document.getElementById("stat-total").textContent = links.length;
    const $statSnoozed = document.getElementById("stat-snoozed");
    if ($statSnoozed) {
      $statSnoozed.textContent =
        links.filter((l) => l.snoozeUntil && l.snoozeUntil > now).length;
    }
    document.getElementById("stat-today").textContent =
      links.filter((l) => l.createdAt >= todayStart.getTime()).length;
  });
}
document.addEventListener("DOMContentLoaded", updateStats);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.parkedLinks) updateStats();
});
