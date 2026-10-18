import type { Metadata } from 'next';

import { LevelsApp } from '@/components/LevelsApp';

export const metadata: Metadata = {
  title: 'VIWANGO — Floors and ceilings for any asset',
};

/**
 * Server component shell. The interactive part lives in `LevelsApp` because the
 * whole tool is one client-side flow: search, fetch, render.
 */
export default function HomePage() {
  return <LevelsApp />;
}
