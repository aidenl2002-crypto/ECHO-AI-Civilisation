// ECHO OS shell: left rail + center world + right context + top world bar +
// bottom event strip. Backend sim on :4000 is the only source of truth.
import React, { Suspense } from 'react';
import { EchoProvider, useEcho } from './store';
import { BottomStrip, CommandPalette, LeftRail, RightPanel, StartScreen, Toasts, TopBar } from './chrome';
import { ErrorBoundary, Skeleton } from './primitives';
import CityView from './views/CityView';
import PeopleView from './views/People';
import { BusinessView, DataView, EconomyView, GovView } from './views/Economy';
import { HistoryView, NewsView, SocialView } from './views/Society';
import CognitionView from './views/Cognition';
import GodView from './views/God';

function Stage() {
  const e = useEcho();
  if (e.cinematic || e.view === 'city') return <CityView />;
  switch (e.view) {
    case 'people': return <PeopleView />;
    case 'business': return <BusinessView />;
    case 'economy': return <EconomyView />;
    case 'gov': return <GovView />;
    case 'social': return <SocialView />;
    case 'news': return <NewsView />;
    case 'history': return <HistoryView />;
    case 'data': return <DataView />;
    case 'brain': return <CognitionView />;
    case 'god': return <GodView />;
    default: return <CityView />;
  }
}

function Shell() {
  const e = useEcho();
  if (!e.started) return <StartScreen />;
  const hideRight = e.cinematic;
  return (
    <div className="echo">
      <TopBar />
      <div className="shell">
        {!e.cinematic && <LeftRail />}
        <div className="center">
          <div className="stage">
            <ErrorBoundary>
              <Suspense fallback={<div className="view"><Skeleton big /></div>}>
                <Stage key={e.view} />
              </Suspense>
            </ErrorBoundary>
          </div>
          <BottomStrip />
        </div>
        {!hideRight && <RightPanel />}
      </div>
      <Toasts />
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <EchoProvider>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </EchoProvider>
  );
}
