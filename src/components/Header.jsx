import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Music2, Search, X } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  const onSearchPage = pathname === '/search';
  const urlQ = onSearchPage ? (params.get('q') ?? '') : '';
  const type = params.get('type') || 'songs';

  const { canInstall, install } = useInstallPrompt();
  const [value, setValue] = useState(urlQ);
  const debounced = useDebounce(value, 400);

  // Keep the input in sync when the URL changes externally (back button, logo click…)
  useEffect(() => {
    if (urlQ !== debounced.trim()) setValue(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  // Live search while typing
  useEffect(() => {
    const q = debounced.trim();
    if (q && q !== urlQ) navigate(`/search?q=${encodeURIComponent(q)}&type=${type}`, { replace: onSearchPage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const submit = (e) => {
    e.preventDefault();
    const q = value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}&type=${type}`, { replace: onSearchPage });
  };

  return (
    <header className="header">
      <div className='header-content'>
        <Link to="/" className="logo" aria-label="Waves home">
          <span className="logo-mark">
            <Music2 size={18} />
          </span>
          <span className="logo-text">Waves</span>
        </Link>

        <form className="search" onSubmit={submit} role="search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search songs, albums, artists…"
            aria-label="Search"
            maxLength={100}
          />
          {value && (
            <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setValue('')}>
              <X size={16} />
            </button>
          )}
        </form>

        {canInstall && (
          <button className="btn install-btn" onClick={install} aria-label="Install app">
            <Download size={16} /> <span>Install</span>
          </button>
        )}
      </div>
    </header>
  );
}
