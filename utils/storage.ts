import { storage } from 'wxt/utils/storage';

export type ClipScope = 'smart' | 'article' | 'full' | 'selection';
export type ClipSource = 'generated-markdown' | 'site-markdown';

export interface FrontMatterFields {
  title: boolean;
  url: boolean;
  date: boolean;
  description: boolean;
  author: boolean;
}

export interface Settings {
  frontMatterEnabled: boolean;
  frontMatterFields: FrontMatterFields;
  defaultScope: ClipScope;
  preferSiteMarkdown: boolean;
  verboseLogging: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  frontMatterEnabled: true,
  frontMatterFields: {
    title: true,
    url: true,
    date: true,
    description: true,
    author: true,
  },
  defaultScope: 'smart',
  preferSiteMarkdown: true,
  verboseLogging: false,
};

export function normalizeSettings(settings: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    frontMatterFields: {
      ...DEFAULT_SETTINGS.frontMatterFields,
      ...settings?.frontMatterFields,
    },
  };
}

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  defaultValue: DEFAULT_SETTINGS,
});
