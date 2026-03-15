# 📋 Clipdown

A browser extension that clips any webpage as clean Markdown — with one click, a keyboard shortcut, or a right-click.

## Features

- **Smart clipping** — auto-detects article content via Mozilla Readability, falls back to full page
- **Site-authored Markdown preference** — can reuse advertised or sidecar `.md` sources before DOM extraction
- **Two clip modes** — Page (auto-detect) · Selection (via context menu)
- **Three trigger points** — toolbar popup · right-click context menu · `Cmd+Shift+M` / `Ctrl+Shift+M`
- **Popup preview** — rendered Markdown and raw text tabs, side by side
- **Copy & Download** — copy to clipboard or download as a named `.md` file
- **YAML front matter** — optionally prepends title, URL, date, description, author
- **LLM token count** — shows estimated token count (GPT-4 cl100k_base) in the popup for quick context budgeting
- **AI-ready output** — paste clean, token-efficient Markdown directly into ChatGPT, Claude, Gemini, or any LLM chat as page context
- **Verbose logging** — toggle detailed console output in settings for debugging
- **Fully configurable** — settings page for front matter fields and preferences
- **Multi-browser** — Chrome (MV3) and Firefox

## Screenshot

> _Popup showing rendered Markdown preview of a clipped article with front matter card_

## Installation

### Development

```bash
bun install
bun run dev          # Chrome
bun run dev:firefox  # Firefox
```

Load the unpacked extension from `.output/chrome-mv3-dev/` in `chrome://extensions`.

### Production build

```bash
bun run build          # Chrome
bun run build:firefox  # Firefox
bun run zip            # Package for upload
```

## Usage

| Action | How |
|---|---|
| Clip current page | Click the toolbar icon |
| Clip selected text | Highlight text → right-click → **Clip Selection as Markdown** |
| Clip via shortcut | `Cmd+Shift+M` (Mac) · `Ctrl+Shift+M` (Windows/Linux) |
| Prefer site Markdown | Enabled by default; configurable in Settings |
| Copy markdown | Click **Copy** in the popup |
| Download as file | Click **Download .md** in the popup |
| Configure | Click ⚙️ in the popup header |

## Use with AI / LLM Tools

Markdown is the cleanest format to feed into AI chat interfaces. Instead of copy-pasting broken text from a webpage, Clipdown gives you structured, token-efficient Markdown — with headers, code blocks, and tables preserved — ready to paste as context into ChatGPT, Claude, Gemini, Cursor, or any other LLM tool.

Typical workflow: clip a docs page or article → switch to **Raw** tab → copy → paste into your AI chat.

## Markdown Source Preference

When enabled, Clipdown first looks for Markdown the site already exposes before running Readability and Turndown. It checks explicit Markdown hints in the page, then retries the current URL with a Markdown-friendly `Accept` header, then probes likely same-origin `.md` sidecars.

If none of those produce usable Markdown, Clipdown falls back to the existing extraction pipeline. **Selection** clips (via context menu) always use the selected DOM content and never override with a site-level Markdown source.

## Tech Stack

- [WXT](https://wxt.dev) — browser extension framework
- [React](https://react.dev) 19
- [Mozilla Readability](https://github.com/mozilla/readability) — article extraction
- [Turndown](https://github.com/mixmark-io/turndown) + [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) — HTML → Markdown
- [react-markdown](https://github.com/remarkjs/react-markdown) — Markdown preview
- [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) — LLM token counting

## License

MIT
