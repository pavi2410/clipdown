import { useCallback, useEffect, useState } from 'react';
import { IconClipboard, IconRefresh, IconSettings } from '@tabler/icons-react';
import { Tabs, Toggle, ToggleGroup } from '@base-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { settingsItem, readCacheEntry, writeCacheEntry, DEFAULT_SETTINGS, normalizeSettings, type Settings, type ClipScope, type ClipSource, type CacheEntry } from '../../utils/storage';
import './style.css';

type PreviewTab = 'raw' | 'rendered';

const SCOPES: { value: ClipScope; label: string }[] = [
  { value: 'smart', label: 'Smart' },
  { value: 'article', label: 'Article' },
  { value: 'full', label: 'Full Page' },
  { value: 'selection', label: 'Selection' },
];

function parseFrontMatter(md: string): { fields: Record<string, string>; body: string } | null {
  if (!md.startsWith('---')) return null;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = md.slice(4, end);
  const body = md.slice(end + 4).replace(/^\n/, '');
  const fields: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^"|"$/g, '');
    if (key) fields[key] = value;
  }
  return { fields, body };
}

function FrontMatterCard({ fields }: { fields: Record<string, string> }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 mb-4 flex flex-col gap-1.5 text-xs">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="flex gap-3 min-w-0">
          <span className="text-neutral-400 font-mono uppercase tracking-wider text-[10px] min-w-18 shrink-0 pt-px">{key}</span>
          {key === 'url'
            ? <a className="text-neutral-600 underline decoration-neutral-300 hover:text-neutral-900 overflow-hidden text-ellipsis whitespace-nowrap block min-w-0" href={value} target="_blank" rel="noreferrer">{value}</a>
            : <span className="text-neutral-800 wrap-break-word min-w-0">{value}</span>
          }
        </div>
      ))}
    </div>
  );
}

function App() {
  const [scope, setScope] = useState<ClipScope>('smart');
  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<ClipSource>('generated-markdown');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('rendered');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    settingsItem.getValue().then((stored: Settings) => {
      const settings = normalizeSettings(stored);
      setScope(settings.defaultScope ?? DEFAULT_SETTINGS.defaultScope);
    });
  }, []);

  const doClip = useCallback(async (s: ClipScope, force = false) => {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) throw new Error('No active tab found');

      const cacheKey = `${tab.url}:${s}`;

      // Inject content script (guarded — safe to call repeatedly)
      await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/content.js'] });

      // Lightweight fingerprint — fast FNV-1a hash, no Readability/Turndown
      const fpResult = await browser.tabs.sendMessage(tab.id, { type: 'fingerprint' }) as { hash: string } | undefined;
      const currentHash = fpResult?.hash ?? '';

      if (!force && currentHash) {
        const entry = await readCacheEntry(cacheKey);
        if (entry?.hash === currentHash) {
          setMarkdown(entry.markdown);
          setTitle(entry.title);
          setSource(entry.source);
          setSourceUrl(entry.sourceUrl ?? null);
          setFromCache(true);
          setElapsedMs(Math.round(performance.now() - t0));
          return;
        }
      }

      // Cache miss or forced — run full clip
      const result = await browser.tabs.sendMessage(tab.id, { type: 'clip', scope: s }) as {
        markdown: string;
        title: string;
        source: ClipSource;
        sourceUrl?: string;
        error?: string;
      } | undefined;
      if (!result) throw new Error('Content script not ready — reload the page and try again');
      if (result.error) throw new Error(result.error);

      if (currentHash) {
        const entry: CacheEntry = {
          markdown: result.markdown,
          title: result.title,
          source: result.source ?? 'generated-markdown',
          sourceUrl: result.sourceUrl,
          hash: currentHash,
          ts: Date.now(),
        };
        await writeCacheEntry(cacheKey, entry);
      }

      setMarkdown(result.markdown);
      setTitle(result.title);
      setSource(result.source ?? 'generated-markdown');
      setSourceUrl(result.sourceUrl ?? null);
      setFromCache(false);
      setElapsedMs(Math.round(performance.now() - t0));
    } catch (e: unknown) {
      setSource('generated-markdown');
      setSourceUrl(null);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { doClip(scope); }, [scope]);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(markdown);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1500);
  }

  async function downloadFile() {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const safe = title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'clip';
    await browser.downloads.download({ url, filename: `${safe}.md`, saveAs: false });
    URL.revokeObjectURL(url);
  }

  function openOptions() {
    browser.runtime.openOptionsPage();
  }

  return (
    <div className="flex flex-col w-115 h-140 overflow-hidden bg-white text-neutral-900">

      {/* Header */}
      <header className="flex items-center justify-between px-3.5 h-11 border-b border-neutral-200 shrink-0">
        <span className="flex items-center gap-1.5 font-semibold text-[13.5px] tracking-tight select-none">
          <IconClipboard size={16} stroke={1.4} className="shrink-0" />
          Clipdown
        </span>
        <div className="flex items-center gap-0.5">
        <button
          onClick={() => doClip(scope, true)}
          disabled={loading}
          title="Re-clip"
          className="flex items-center justify-center w-7 h-7 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer border-none bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <IconRefresh size={15} stroke={1.4} />
        </button>
        <button
          onClick={openOptions}
          title="Settings"
          className="flex items-center justify-center w-7 h-7 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer border-none bg-transparent"
        >
          <IconSettings size={15} stroke={1.3} />
        </button>
        </div>
      </header>

      {/* Scope selector */}
      <ToggleGroup
        value={[scope]}
        onValueChange={(groupValue) => {
          const nextScope = groupValue[0] as ClipScope | undefined;
          if (nextScope) setScope(nextScope);
        }}
        disabled={loading}
        className="flex gap-1 px-3 py-2 border-b border-neutral-200 bg-neutral-50 shrink-0"
      >
        {SCOPES.map((s) => (
          <Toggle
            key={s.value}
            value={s.value}
            disabled={loading}
            className="flex-1 py-1.5 px-1 text-xs font-medium rounded-md border border-transparent text-neutral-500 cursor-pointer bg-transparent transition-colors
              hover:bg-neutral-100 hover:text-neutral-800 hover:border-neutral-200
              data-pressed:bg-neutral-900 data-pressed:text-white data-pressed:border-neutral-900 data-pressed:font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {s.label}
          </Toggle>
        ))}
      </ToggleGroup>

      {/* Source banner */}
      {!loading && !error && markdown && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-mono font-medium shrink-0
              ${source === 'site-markdown'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
              {source === 'site-markdown' ? 'site-markdown' : 'generated'}
            </span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-mono font-medium shrink-0
              ${fromCache
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
              {fromCache ? '⚡ cache' : 'live'}
            </span>
            {elapsedMs !== null && (
              <span className="text-[10.5px] text-neutral-400 font-mono shrink-0">{elapsedMs}ms</span>
            )}
          </div>
          {source === 'site-markdown' && sourceUrl && (
            <a className="text-[11px] text-neutral-400 hover:text-neutral-700 no-underline hover:underline shrink-0" href={sourceUrl} target="_blank" rel="noreferrer">
              Source ↗
            </a>
          )}
        </div>
      )}

      {/* Preview tabs */}
      <Tabs.Root
        value={previewTab}
        onValueChange={(value) => setPreviewTab(value as PreviewTab)}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <Tabs.List className="flex border-b border-neutral-200 px-3.5 bg-neutral-50 shrink-0">
          <Tabs.Tab
            value="rendered"
            className="py-2 px-2.5 text-xs font-medium border-b-[1.5px] border-transparent -mb-px text-neutral-400 cursor-pointer bg-transparent border-none transition-colors
              hover:text-neutral-600 data-active:text-neutral-900 data-active:border-neutral-900"
          >
            Rendered
          </Tabs.Tab>
          <Tabs.Tab
            value="raw"
            className="py-2 px-2.5 text-xs font-medium border-b-[1.5px] border-transparent -mb-px text-neutral-400 cursor-pointer bg-transparent border-none transition-colors
              hover:text-neutral-600 data-active:text-neutral-900 data-active:border-neutral-900"
          >
            Raw
          </Tabs.Tab>
        </Tabs.List>

        <div className="flex-1 min-h-0 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-[13px]">
              Clipping…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-600 text-[13px] px-6 text-center">
              {error}
            </div>
          )}
          {!loading && !error && (
            <>
              <Tabs.Panel keepMounted value="raw" className="h-full min-h-0 overflow-hidden">
                <textarea
                  className="block w-full h-full border-none resize-none p-3.5 font-mono text-[11.5px] leading-relaxed bg-neutral-50 text-neutral-800 outline-none"
                  readOnly
                  value={markdown}
                />
              </Tabs.Panel>
              <Tabs.Panel keepMounted value="rendered" className="rendered-preview h-full min-h-0 overflow-y-auto px-4 py-3.5 pb-7 text-[13px] leading-relaxed">
                {(() => {
                  const parsed = parseFrontMatter(markdown);
                  if (parsed) return (
                    <>
                      <FrontMatterCard fields={parsed.fields} />
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
                    </>
                  );
                  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>;
                })()}
              </Tabs.Panel>
            </>
          )}
        </div>
      </Tabs.Root>

      {/* Action bar */}
      <div className="flex gap-2 px-3 py-2.5 border-t border-neutral-200 bg-neutral-50 shrink-0">
        <button
          onClick={copyToClipboard}
          disabled={!markdown || loading}
          className="flex-1 py-1.5 text-[13px] font-medium rounded-md border border-neutral-900 bg-neutral-900 text-white cursor-pointer transition-colors
            hover:bg-neutral-800 hover:border-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          {copyDone ? '✓ Copied!' : 'Copy'}
        </button>
        <button
          onClick={downloadFile}
          disabled={!markdown || loading}
          className="flex-1 py-1.5 text-[13px] font-medium rounded-md border border-neutral-300 bg-white text-neutral-800 cursor-pointer transition-colors
            hover:bg-neutral-50 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          Download .md
        </button>
      </div>
    </div>
  );
}

export default App;
