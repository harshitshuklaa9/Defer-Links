Defer: Link Parking for Power Users

You don't have a tab problem. You have a memory problem.

Defer lets you save links for later without opening them. Right-click any link, click Park for Later. No new tab, no RAM hit, no interruption to your flow.
Show Image

The Problem
Every tab you keep open is a thought you don't want to lose.

Bookmarks: too permanent, never revisited
Tab groups: still clutter, still eating memory
Pocket: feels like homework, adds guilt

None of them solve the real behavior: "I want to save this link, close the tab, and come back on my own terms."

The Solution
Defer is a parking lot for links. Temporary. Lightweight. Gone when you're done.

Features

Right-click to park: save any link without opening it
Side panel UI: clean, always accessible, never in the way
Smart groups: organize into Research, Shopping, Reading, Jobs, Uncategorized
Batch open: select multiple links and open them all at once
Stats: see how many links you've parked today
Delete instantly: clean up links you no longer need
100% local: no account, no servers, no data leaves your browser


Installation
From Chrome Web Store
(Review pending, link coming soon)
Load Locally (Developer Mode)

Clone this repo or download the ZIP
Go to chrome://extensions
Toggle Developer mode ON (top right)
Click Load unpacked
Select the defer folder
The Defer icon appears in your toolbar


How to Use

Browse any website
Right-click any link you want to revisit later
Select "Park for Later"
Click the Defer icon in your toolbar to see all parked links
Open individually or batch-open with Open Selected


Tech Stack

Chrome Manifest V3
Vanilla HTML, CSS, JavaScript , no frameworks, no bundlers
chrome.storage.local , all data stored locally on device
chrome.contextMenus , right-click integration
chrome.sidePanel , persistent side panel UI


Project Structure
defer/
├── manifest.json        # Extension config and permissions
├── background.js        # Service worker, context menu logic
├── contentScript.js     # Captures link text on right-click
├── sidepanel.html       # Main UI
├── sidepanel.css        # Styles
├── popup.html           # Popup UI
├── popup.css            # Popup styles
├── popup.js             # All UI logic, storage interactions
├── icons/               # Extension icons
└── fonts/               # Local fonts

Privacy
Defer collects zero user data. Everything stays on your device.
No analytics. No tracking. No accounts. No servers.
Full Privacy Policy

The Story
Built in one weekend using Claude Code. I'm a PM. I don't write code. I described the problem, defined the behavior, and iterated on the UX. Claude wrote the code.
What I learned: the bottleneck was never the code. It was knowing exactly what to build and what to cut. That's a PM skill.

Roadmap

 AI auto-categorization , automatically sort links into the right group
 Link summarization , one-line AI summary of each parked link
 Duplicate detection , flag links you've already parked
 Keyboard shortcut to open panel


Author
Harshit Shukla | AI Product Manager | HealthTech | Revenue Systems
LinkedIn · GitHub

If you have 40+ tabs open right now, this was built for you.
