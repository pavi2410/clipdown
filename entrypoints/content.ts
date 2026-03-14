import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
// @ts-expect-error no types for this package
import { gfm } from 'turndown-plugin-gfm';
import { settingsItem, type ClipScope } from '../utils/storage';

let verbose = false;
const log = (...args: unknown[]) => verbose && console.log('[Clipdown]', ...args);

function buildTurndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  td.use(gfm);
  return td;
}

function selectionToHtml(): string | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const div = document.createElement('div');
  div.appendChild(range.cloneContents());
  return div.innerHTML;
}

function articleToHtml(): { html: string; title: string; author: string; excerpt: string } | null {
  const doc = document.cloneNode(true) as Document;
  const reader = new Readability(doc);
  const article = reader.parse();
  if (!article) return null;
  return {
    html: article.content ?? '',
    title: article.title ?? '',
    author: article.byline ?? '',
    excerpt: article.excerpt ?? '',
  };
}

interface ClipResult {
  markdown: string;
  title: string;
}

async function clip(scope: ClipScope): Promise<ClipResult> {
  const td = buildTurndown();
  const settings = await settingsItem.getValue();
  verbose = settings.verboseLogging;

  log('clip() called', { scope, url: window.location.href });

  let html: string;
  let pageTitle = document.title;
  let author = '';
  let description = '';

  if (scope === 'selection') {
    const selHtml = selectionToHtml();
    if (selHtml) {
      log('selection: captured', selHtml.length, 'chars of HTML');
      html = selHtml;
    } else {
      log('selection: nothing selected, falling back to body');
      html = document.body.innerHTML;
    }
  } else if (scope === 'article') {
    const art = articleToHtml();
    if (art) {
      log('article: Readability parsed', { title: art.title, htmlLen: art.html.length });
      html = art.html;
      pageTitle = art.title || pageTitle;
      author = art.author;
      description = art.excerpt;
    } else {
      log('article: Readability failed, falling back to body');
      html = document.body.innerHTML;
    }
  } else if (scope === 'full') {
    log('full: using document.body', document.body.innerHTML.length, 'chars');
    html = document.body.innerHTML;
  } else {
    // smart: try article first
    const art = articleToHtml();
    if (art) {
      log('smart: Readability succeeded', { title: art.title, htmlLen: art.html.length });
      html = art.html;
      pageTitle = art.title || pageTitle;
      author = art.author;
      description = art.excerpt;
    } else {
      log('smart: Readability failed, falling back to full body');
      html = document.body.innerHTML;
    }
  }

  // Fall back to meta description/author if Readability didn't find them
  if (!description) {
    description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
      '';
  }
  if (!author) {
    author =
      document.querySelector<HTMLMetaElement>('meta[name="author"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="article:author"]')?.content ??
      '';
  }

  log('metadata resolved', { pageTitle, author, description: description.slice(0, 80) });

  let markdown = td.turndown(html);
  log('turndown complete', markdown.length, 'chars of markdown');

  if (settings.frontMatterEnabled) {
    const f = settings.frontMatterFields;
    const lines: string[] = ['---'];
    if (f.title) lines.push(`title: "${pageTitle.replace(/"/g, '\\"')}"`);
    if (f.url) lines.push(`url: "${window.location.href}"`);
    if (f.date) lines.push(`date: "${new Date().toISOString().slice(0, 10)}"`);
    if (f.description && description) lines.push(`description: "${description.replace(/"/g, '\\"')}"`);
    if (f.author && author) lines.push(`author: "${author.replace(/"/g, '\\"')}"`);
    lines.push('---');
    markdown = lines.join('\n') + '\n\n' + markdown;
  }

  log('clip() done', { frontMatter: settings.frontMatterEnabled, markdownLen: markdown.length });
  return { markdown, title: pageTitle };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener(
      (message: { type: string; scope?: ClipScope }, _sender, sendResponse) => {
        if (message.type === 'clip') {
          log('message received', message);
          clip(message.scope ?? 'smart')
            .then(sendResponse)
            .catch((e: unknown) => sendResponse({ error: e instanceof Error ? e.message : String(e) }));
          return true; // keep channel open for async sendResponse
        }
      },
    );
  },
});
