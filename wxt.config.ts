import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Clipdown',
    description: 'Clip any webpage as Markdown',
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
