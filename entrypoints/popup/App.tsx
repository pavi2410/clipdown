import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { settingsItem, DEFAULT_SETTINGS, normalizeSettings, type Settings, type ClipScope, type ClipSource } from '../../utils/storage';
import './App.css';

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
  const block = md.slice(4, end); // content between the fences
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

const FIELD_ICONS: Record<string, string> = {
  title: '📄',
  url: '🔗',
  date: '📅',
  description: '💬',
  author: '✍️',
};

function FrontMatterCard({ fields }: { fields: Record<string, string> }) {
  return (
    <div className="fm-card">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="fm-row">
          <span className="fm-key">{FIELD_ICONS[key] ?? '•'} {key}</span>
          {key === 'url'
            ? <a className="fm-value fm-link" href={value} target="_blank" rel="noreferrer">{value}</a>
            : <span className="fm-value">{value}</span>
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

  // Load default scope from settings on mount
  useEffect(() => {
    settingsItem.getValue().then((stored: Settings) => {
      const settings = normalizeSettings(stored);
      setScope(settings.defaultScope ?? DEFAULT_SETTINGS.defaultScope);
    });
  }, []);

  const doClip = useCallback(async (s: ClipScope) => {
    setLoading(true);
    setError(null);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');
      const result = await browser.tabs.sendMessage(tab.id, { type: 'clip', scope: s }) as {
        markdown: string;
        title: string;
        source: ClipSource;
        sourceUrl?: string;
        error?: string;
      } | undefined;
      if (!result) throw new Error('Content script not ready — reload the page and try again');
      if (result.error) throw new Error(result.error);
      setMarkdown(result.markdown);
      setTitle(result.title);
      setSource(result.source ?? 'generated-markdown');
      setSourceUrl(result.sourceUrl ?? null);
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
    <div className="app">
      <header className="header">
        <span className="logo-text">📋 Clipdown</span>
        <button className="settings-btn" onClick={openOptions} title="Settings">⚙️</button>
      </header>

      <div className="scope-bar">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            className={`scope-btn${scope === s.value ? ' active' : ''}`}
            onClick={() => setScope(s.value)}
            disabled={loading}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!loading && !error && markdown && (
        <div className="source-banner">
          <span className={`source-pill ${source === 'site-markdown' ? 'site' : 'generated'}`}>
            {source === 'site-markdown' ? 'Site Markdown' : 'Generated Markdown'}
          </span>
          {source === 'site-markdown' && sourceUrl && (
            <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
          )}
        </div>
      )}

      <div className="preview-tabs">
        <button className={`tab-btn${previewTab === 'rendered' ? ' active' : ''}`} onClick={() => setPreviewTab('rendered')}>Rendered</button>
        <button className={`tab-btn${previewTab === 'raw' ? ' active' : ''}`} onClick={() => setPreviewTab('raw')}>Raw</button>
      </div>

      <div className="preview-area">
        {loading && <div className="state-msg">Clipping…</div>}
        {error && <div className="state-msg error">{error}</div>}
        {!loading && !error && previewTab === 'raw' && (
          <textarea className="raw-preview" readOnly value={markdown} />
        )}
        {!loading && !error && previewTab === 'rendered' && (
          <div className="rendered-preview">
            {(() => {
              const parsed = parseFrontMatter(markdown);
              if (parsed) return (
                <>
                  <FrontMatterCard fields={parsed.fields} />
                  <ReactMarkdown>{parsed.body}</ReactMarkdown>
                </>
              );
              return <ReactMarkdown>{markdown}</ReactMarkdown>;
            })()}
          </div>
        )}
      </div>

      <div className="action-bar">
        <button className="action-btn primary" onClick={copyToClipboard} disabled={!markdown || loading}>
          {copyDone ? '✓ Copied!' : 'Copy'}
        </button>
        <button className="action-btn" onClick={downloadFile} disabled={!markdown || loading}>
          Download .md
        </button>
      </div>
    </div>
  );
}

export default App;
