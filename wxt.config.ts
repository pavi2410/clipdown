import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: {
    name: 'Clipdown',
    description: 'Clip any webpage as clean Markdown — for Obsidian, Logseq, Notion, and pasting context into ChatGPT, Claude & Gemini.',
    permissions: ['activeTab', 'contextMenus', 'downloads', 'storage', 'scripting'],
    commands: {
      'clip-to-markdown': {
        suggested_key: {
          default: 'Ctrl+Shift+M',
          mac: 'Command+Shift+M',
        },
        description: 'Clip current page to Markdown',
      },
    },
  },
});
