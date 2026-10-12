import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Player from './Player';
import Toaster from './Toaster';
import PwaPrompt from './PwaPrompt';
import { PageLoader } from './Skeletons';
import { usePlayerStore } from '../store/playerStore';

export default function Layout() {
  const { pathname } = useLocation();
  const hasPlayer = usePlayerStore((s) => s.index >= 0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className={`app ${hasPlayer ? 'has-player' : ''}`}>
      <Header />
      <main className="main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Player />
      <PwaPrompt />
      <Toaster />
    </div>
  );
}
