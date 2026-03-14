import { storage } from 'wxt/utils/storage';

export type ClipScope = 'smart' | 'article' | 'full' | 'selection';

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
};

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  defaultValue: DEFAULT_SETTINGS,
});
