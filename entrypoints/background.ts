import { settingsItem } from '../utils/settings';

const log = async (...args: unknown[]) => {
  const s = await settingsItem.getValue();
  if (s.verboseLogging) console.log('[Clipdown:bg]', ...args);
};

export default defineBackground(() => {
  // Create context menu entries
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'clip-page',
      title: 'Clip Page as Markdown',
      contexts: ['page'],
    });
    browser.contextMenus.create({
      id: 'clip-selection',
      title: 'Clip Selection as Markdown',
      contexts: ['selection'],
    });
  });

  async function clipAndCopy(tabId: number, scope: 'page' | 'selection') {
    log('clipAndCopy', { tabId, scope });
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
    const response = await browser.tabs.sendMessage(tabId, { type: 'clip', scope }) as { markdown: string; title: string } | undefined;
    if (!response) { log('no response from content script'); return; }
    log('clip response received', { title: response.title, markdownLen: response.markdown.length });
    // Write to clipboard via a content script execution (MV3 — content script has DOM access)
    await browser.scripting.executeScript({
      target: { tabId },
      func: (text: string) => navigator.clipboard.writeText(text),
      args: [response.markdown],
    });
    log('clipboard written');
  }

  // Context menu click handler
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    log('context menu clicked', info.menuItemId);
    if (info.menuItemId === 'clip-page') {
      clipAndCopy(tab.id, 'page');
    } else if (info.menuItemId === 'clip-selection') {
      clipAndCopy(tab.id, 'selection');
    }
  });

  // Keyboard shortcut handler
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'clip-to-markdown') return;
    log('keyboard shortcut triggered');
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    clipAndCopy(tab.id, 'page');
  });
});
