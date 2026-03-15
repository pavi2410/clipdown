import { useState, useEffect } from 'react';
import { IconClipboard } from '@tabler/icons-react';
import { Checkbox, Radio, RadioGroup, Switch } from '@base-ui/react';
import { settingsItem, DEFAULT_SETTINGS, normalizeSettings, type Settings, type ClipScope } from '../../utils/storage';
import './options.css';

const SCOPE_OPTIONS: { value: ClipScope; label: string }[] = [
  { value: 'smart', label: 'Smart (auto-detect)' },
  { value: 'article', label: 'Article' },
  { value: 'full', label: 'Full Page' },
  { value: 'selection', label: 'Selection' },
];

const FRONT_MATTER_FIELDS: { key: keyof Settings['frontMatterFields']; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'url', label: 'URL' },
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'author', label: 'Author' },
];

function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settingsItem.getValue().then((stored) => setSettings(normalizeSettings(stored)));
  }, []);

  async function save(updated: Settings) {
    await settingsItem.setValue(updated);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function setFrontMatterEnabled(enabled: boolean) {
    save({ ...settings, frontMatterEnabled: enabled });
  }

  function setFrontMatterField(key: keyof Settings['frontMatterFields'], value: boolean) {
    save({ ...settings, frontMatterFields: { ...settings.frontMatterFields, [key]: value } });
  }

  function setDefaultScope(scope: ClipScope) {
    save({ ...settings, defaultScope: scope });
  }

  function setPreferSiteMarkdown(enabled: boolean) {
    save({ ...settings, preferSiteMarkdown: enabled });
  }

  function setVerboseLogging(enabled: boolean) {
    save({ ...settings, verboseLogging: enabled });
  }

  return (
    <div className="max-w-140 mx-auto px-6 py-8 text-neutral-900">
      <header className="flex items-center gap-4 mb-8">
        <h1 className="text-[20px] font-semibold tracking-tight m-0 flex items-center gap-2.5">
          <IconClipboard size={20} stroke={1.4} />
          Clipdown
        </h1>
        {saved && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded font-medium">
            ✓ Saved
          </span>
        )}
      </header>

      {/* Default Clip Scope */}
      <section className="bg-white border border-neutral-200 rounded-lg px-5 py-4 mb-3">
        <h2 className="text-[13.5px] font-semibold tracking-tight mb-0.5">Default Clip Scope</h2>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">What should be clipped when you open the popup?</p>
        <RadioGroup
          value={settings.defaultScope}
          onValueChange={(value) => setDefaultScope(value as ClipScope)}
          className="flex flex-col gap-2"
        >
          {SCOPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 text-[13px] cursor-pointer">
              <Radio.Root
                value={opt.value}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-neutral-300 bg-white shrink-0"
              >
                <Radio.Indicator className="w-2 h-2 rounded-full bg-neutral-900 opacity-0 data-checked:opacity-100" />
              </Radio.Root>
              <span>{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
      </section>

      {/* Markdown Sources */}
      <section className="bg-white border border-neutral-200 rounded-lg px-5 py-4 mb-3">
        <h2 className="text-[13.5px] font-semibold tracking-tight mb-0.5">Markdown Sources</h2>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">Prefer site-provided Markdown when available for Smart, Article, and Full Page clips.</p>
        <label className="flex items-center gap-2.5 text-[13px] font-medium cursor-pointer">
          <Switch.Root
            checked={settings.preferSiteMarkdown}
            onCheckedChange={setPreferSiteMarkdown}
            className="relative inline-flex w-8.5 h-5 items-center rounded-full bg-neutral-200 shrink-0 transition-colors data-checked:bg-neutral-900"
          >
            <Switch.Thumb className="w-3.5 h-3.5 ml-0.75 rounded-full bg-white transition-transform data-checked:translate-x-3.5" />
          </Switch.Root>
          Prefer site-provided Markdown
        </label>
      </section>

      {/* Front Matter */}
      <section className="bg-white border border-neutral-200 rounded-lg px-5 py-4 mb-3">
        <h2 className="text-[13.5px] font-semibold tracking-tight mb-0.5">Front Matter</h2>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">Prepend YAML front matter to every clipped document.</p>
        <label className="flex items-center gap-2.5 text-[13px] font-medium cursor-pointer">
          <Switch.Root
            checked={settings.frontMatterEnabled}
            onCheckedChange={setFrontMatterEnabled}
            className="relative inline-flex w-8.5 h-5 items-center rounded-full bg-neutral-200 shrink-0 transition-colors data-checked:bg-neutral-900"
          >
            <Switch.Thumb className="w-3.5 h-3.5 ml-0.75 rounded-full bg-white transition-transform data-checked:translate-x-3.5" />
          </Switch.Root>
          Enable front matter
        </label>

        {settings.frontMatterEnabled && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-[10.5px] text-neutral-400 uppercase tracking-widest mb-2 font-medium">Included fields</p>
            {FRONT_MATTER_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 py-1 text-[13px] cursor-pointer">
                <Checkbox.Root
                  checked={settings.frontMatterFields[key]}
                  onCheckedChange={(checked) => setFrontMatterField(key, checked)}
                  className="inline-flex items-center justify-center w-4 h-4 rounded border border-neutral-300 bg-white shrink-0 data-checked:bg-neutral-900 data-checked:border-neutral-900"
                >
                  <Checkbox.Indicator className="text-white text-[11px] leading-none opacity-0 data-checked:opacity-100" keepMounted>
                    ✓
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Keyboard Shortcut */}
      <section className="bg-white border border-neutral-200 rounded-lg px-5 py-4 mb-3">
        <h2 className="text-[13.5px] font-semibold tracking-tight mb-0.5">Keyboard Shortcut</h2>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">Clip the current page to your clipboard without opening the popup.</p>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-neutral-700">Clip current page</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[11px] font-mono text-neutral-600">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[11px] font-mono text-neutral-600">⇧</kbd>
            <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[11px] font-mono text-neutral-600">M</kbd>
          </span>
        </div>
      </section>

      {/* Developer */}
      <section className="bg-white border border-neutral-200 rounded-lg px-5 py-4 mb-3">
        <h2 className="text-[13.5px] font-semibold tracking-tight mb-0.5">Developer</h2>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">Logs detailed output to the browser console (content script + background).</p>
        <label className="flex items-center gap-2.5 text-[13px] font-medium cursor-pointer">
          <Switch.Root
            checked={settings.verboseLogging}
            onCheckedChange={setVerboseLogging}
            className="relative inline-flex w-8.5 h-5 items-center rounded-full bg-neutral-200 shrink-0 transition-colors data-checked:bg-neutral-900"
          >
            <Switch.Thumb className="w-3.5 h-3.5 ml-0.75 rounded-full bg-white transition-transform data-checked:translate-x-3.5" />
          </Switch.Root>
          Verbose logging
        </label>
      </section>
    </div>
  );
}

export default Options;
