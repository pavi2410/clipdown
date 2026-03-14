import { useState, useEffect } from 'react';
import { settingsItem, DEFAULT_SETTINGS, type Settings, type ClipScope } from '../../utils/storage';

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
    settingsItem.getValue().then(setSettings);
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

  return (
    <div className="options">
      <header className="options-header">
        <h1>📋 Clipdown Settings</h1>
        {saved && <span className="saved-badge">✓ Saved</span>}
      </header>

      <section className="section">
        <h2>Default Clip Scope</h2>
        <p className="section-desc">What should be clipped when you open the popup?</p>
        <div className="radio-group">
          {SCOPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="radio-label">
              <input
                type="radio"
                name="scope"
                value={opt.value}
                checked={settings.defaultScope === opt.value}
                onChange={() => setDefaultScope(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Front Matter</h2>
        <p className="section-desc">Prepend YAML front matter to every clipped document.</p>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.frontMatterEnabled}
            onChange={(e) => setFrontMatterEnabled(e.target.checked)}
          />
          Enable front matter
        </label>

        {settings.frontMatterEnabled && (
          <div className="fields-group">
            <p className="fields-label">Included fields:</p>
            {FRONT_MATTER_FIELDS.map(({ key, label }) => (
              <label key={key} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.frontMatterFields[key]}
                  onChange={(e) => setFrontMatterField(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Options;
