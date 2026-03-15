import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
// @ts-expect-error no types for this package
import { gfm } from 'turndown-plugin-gfm';
import { settingsItem, normalizeSettings, type ClipScope, type ClipSource } from '../utils/storage';

let verbose = false;
const log = (...args: unknown[]) => verbose && console.log('[Clipdown]', ...args);
const MARKDOWN_ACCEPT_HEADER = 'text/markdown, text/x-markdown;q=0.99, text/plain;q=0.9, text/html;q=0.5';

interface PageMetadata {
  title: string;
  author: string;
  description: string;
}

interface MarkdownCandidate {
  markdown: string;
  sourceUrl: string;
  strategy: 'alternate-link' | 'content-negotiation' | 'sidecar';
}

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

function getFallbackMetadata(): PageMetadata {
  return {
    title: document.title,
    description:
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
      '',
    author:
      document.querySelector<HTMLMetaElement>('meta[name="author"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="article:author"]')?.content ??
      '',
  };
}

function looksLikeHtml(text: string): boolean {
  const sample = text.trim().slice(0, 500).toLowerCase();
  return sample.startsWith('<!doctype html') || sample.startsWith('<html') || sample.startsWith('<body') || sample.startsWith('<head');
}

function looksLikeMarkdown(text: string): boolean {
  if (/^\s*#{1,6}\s+/m.test(text)) return true;
  if (/^\s*([-*+]\s+|\d+\.\s+)/m.test(text)) return true;
  if (/```[\s\S]*```/.test(text)) return true;
  if (/\[[^\]]+\]\([^\)]+\)/.test(text)) return true;
  if (/^\s*>\s+/m.test(text)) return true;
  if (/^---\s*\n[\s\S]+\n---\s*(\n|$)/.test(text)) return true;
  return false;
}

function hasFrontMatter(markdown: string): boolean {
  return /^---\s*\n[\s\S]+\n---\s*(\n|$)/.test(markdown);
}

function canUseMarkdownResponse(url: string, contentType: string | null, text: string): boolean {
  const normalizedUrl = url.toLowerCase();
  const normalizedContentType = contentType?.toLowerCase() ?? '';
  if (!text.trim() || looksLikeHtml(text)) return false;
  if (normalizedContentType.includes('markdown')) return true;
  if (normalizedUrl.endsWith('.md') || normalizedUrl.includes('.md?') || normalizedUrl.includes('.md#')) return true;
  return looksLikeMarkdown(text);
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

function getAlternateMarkdownUrls(): string[] {
  const elements = document.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][href], link[type*="markdown"][href], link[href$=".md"]');
  const currentOrigin = window.location.origin;
  const urls: string[] = [];

  for (const element of elements) {
    try {
      const url = new URL(element.href, window.location.href);
      if (url.origin === currentOrigin) urls.push(url.toString());
    } catch {
      log('skipping invalid markdown hint', element.href);
    }
  }

  return uniqueUrls(urls);
}

function buildSidecarCandidates(): string[] {
  const currentUrl = new URL(window.location.href);
  const { origin, pathname, search, hash } = currentUrl;
  const candidates: string[] = [];
  const trimmedPath = pathname.replace(/\/+$/, '');

  if (pathname !== '/' && trimmedPath) {
    candidates.push(new URL(`${trimmedPath}.md${search}${hash}`, origin).toString());
    candidates.push(new URL(`${trimmedPath}/index.md${search}${hash}`, origin).toString());
  }

  if (/\.(html?|xhtml)$/i.test(pathname)) {
    const replaced = pathname.replace(/\.(html?|xhtml)$/i, '.md');
    candidates.push(new URL(`${replaced}${search}${hash}`, origin).toString());
  }

  if (pathname.endsWith('/')) {
    candidates.push(new URL(`${pathname}index.md${search}${hash}`, origin).toString());
  }

  if (pathname === '/') {
    candidates.push(new URL(`/index.md${search}${hash}`, origin).toString());
  }

  return uniqueUrls(candidates).filter((candidate) => candidate !== currentUrl.toString());
}

async function fetchMarkdownCandidate(
  url: string,
  strategy: MarkdownCandidate['strategy'],
  acceptHeader = MARKDOWN_ACCEPT_HEADER,
): Promise<MarkdownCandidate | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: acceptHeader },
      credentials: 'include',
    });

    if (!response.ok) {
      log('markdown fetch rejected', { strategy, url, status: response.status });
      return null;
    }

    const text = await response.text();
    const responseUrl = response.url || url;
    if (!canUseMarkdownResponse(responseUrl, response.headers.get('content-type'), text)) {
      log('markdown fetch not usable', {
        strategy,
        url: responseUrl,
        contentType: response.headers.get('content-type'),
      });
      return null;
    }

    log('markdown fetch accepted', { strategy, url: responseUrl, length: text.length });
    return {
      markdown: text.trim(),
      sourceUrl: responseUrl,
      strategy,
    };
  } catch (error) {
    log('markdown fetch failed', { strategy, url, error });
    return null;
  }
}

async function discoverSiteMarkdown(): Promise<MarkdownCandidate | null> {
  for (const alternateUrl of getAlternateMarkdownUrls()) {
    const candidate = await fetchMarkdownCandidate(alternateUrl, 'alternate-link');
    if (candidate) return candidate;
  }

  const negotiated = await fetchMarkdownCandidate(window.location.href, 'content-negotiation');
  if (negotiated) return negotiated;

  for (const sidecarUrl of buildSidecarCandidates()) {
    const candidate = await fetchMarkdownCandidate(sidecarUrl, 'sidecar');
    if (candidate) return candidate;
  }

  return null;
}

interface ClipResult {
  markdown: string;
  title: string;
  source: ClipSource;
  sourceUrl?: string;
}

async function clip(scope: ClipScope): Promise<ClipResult> {
  const td = buildTurndown();
  const settings = normalizeSettings(await settingsItem.getValue());
  verbose = settings.verboseLogging;

  log('clip() called', { scope, url: window.location.href });

  const fallbackMetadata = getFallbackMetadata();
  let html: string;
  let pageTitle = fallbackMetadata.title;
  let author = fallbackMetadata.author;
  let description = fallbackMetadata.description;
  let markdown = '';
  let source: ClipSource = 'generated-markdown';
  let sourceUrl: string | undefined;

  if (scope !== 'selection' && settings.preferSiteMarkdown) {
    const candidate = await discoverSiteMarkdown();
    if (candidate) {
      markdown = candidate.markdown;
      source = 'site-markdown';
      sourceUrl = candidate.sourceUrl;
      log('using site markdown', { strategy: candidate.strategy, sourceUrl });
    }
  }

  if (!markdown) {
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
        author = art.author || author;
        description = art.excerpt || description;
      } else {
        log('article: Readability failed, falling back to body');
        html = document.body.innerHTML;
      }
    } else if (scope === 'full') {
      log('full: using document.body', document.body.innerHTML.length, 'chars');
      html = document.body.innerHTML;
    } else {
      const art = articleToHtml();
      if (art) {
        log('smart: Readability succeeded', { title: art.title, htmlLen: art.html.length });
        html = art.html;
        pageTitle = art.title || pageTitle;
        author = art.author || author;
        description = art.excerpt || description;
      } else {
        log('smart: Readability failed, falling back to full body');
        html = document.body.innerHTML;
      }
    }

    log('metadata resolved', { pageTitle, author, description: description.slice(0, 80) });

    markdown = td.turndown(html);
    log('turndown complete', markdown.length, 'chars of markdown');
  }

  if (settings.frontMatterEnabled && !(source === 'site-markdown' && hasFrontMatter(markdown))) {
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

  log('clip() done', { frontMatter: settings.frontMatterEnabled, markdownLen: markdown.length, source, sourceUrl });
  return { markdown, title: pageTitle, source, sourceUrl };
}

export default defineContentScript({
  registration: 'runtime',
  main() {
    const guard = '__clipdownLoaded';
    if ((window as unknown as Record<string, unknown>)[guard]) return;
    (window as unknown as Record<string, unknown>)[guard] = true;

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
