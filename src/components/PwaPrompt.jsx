import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../store/toastStore';
import { isIos, isStandalone } from '../hooks/useInstallPrompt';

const IOS_HINT_KEY = 'waves-ios-hint-dismissed';
const HOUR = 60 * 60 * 1000;

export default function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // look for a new version every hour while the app stays open
      if (registration) setInterval(() => registration.update().catch(() => {}), HOUR);
    }
  });

  const [showIosHint, setShowIosHint] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(IOS_HINT_KEY) === '1';
    } catch {
      /* ignore */
    }
    setShowIosHint(isIos() && !isStandalone() && !dismissed);
  }, []);

  useEffect(() => {
    const off = () => toast.error("You're offline – saved content only");
    const on = () => toast.info('Back online');
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, []);

  const dismissIos = () => {
    setShowIosHint(false);
    try {
      localStorage.setItem(IOS_HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (needRefresh) {
    return (
      <div className="pwa-banner" role="status">
        <span>A new version is available.</span>
        <div className="pwa-actions">
          {/* reloading stops playback, so only ever on an explicit tap */}
          <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
            Refresh
          </button>
          <button className="btn" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div className="pwa-banner" role="status">
        <span>Install Waves: tap Share, then “Add to Home Screen”.</span>
        <div className="pwa-actions">
          <button className="btn" onClick={dismissIos}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  return null;
}
