import type { PageGuide } from '../../guides/types';

const guides: Record<string, PageGuide> = {};

export const getGuideForPage = (tabId: string): PageGuide | null => {
  return guides[tabId] ?? null;
};
