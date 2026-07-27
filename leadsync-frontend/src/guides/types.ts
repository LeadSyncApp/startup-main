import { ComponentType } from 'react';

export interface GuideSection {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  icon: ComponentType<{ className?: string }>;
  wizardStep?: string;
}

export interface PageGuide {
  pageId: string;
  pageTitle: string;
  sections: GuideSection[];
}
