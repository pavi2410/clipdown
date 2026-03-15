import { storage } from 'wxt/utils/storage';

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
