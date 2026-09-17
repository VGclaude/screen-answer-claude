# Screen Answer (Claude)

A small Tampermonkey userscript. Click **Capture** (or press **⇧⌘]** / Shift+Ctrl+]),
pick a screen or window to share, and Claude reads what's on it and shows a short
answer in a corner box.

## Install
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and paste in `screen-answer-claude.user.js` (or drag the file
   into the Tampermonkey dashboard).
3. On first Capture it asks for your Anthropic API key (`sk-ant-...`), stored locally
   in Tampermonkey via `GM_setValue` — it is **not** hardcoded in the script.

## Controls
- **Capture** button or **⇧⌘§** — grab one frame of the shared screen and ask Claude.
- **⇧⌘\\** — hide / show the box (when hidden, a small pill remains; click it to restore).
- Drag the blue header to move the box.

## Notes
- Uses the Claude `claude-opus-5` model via the Anthropic Messages API.
- Your API key lives in your browser — treat it like a password.
