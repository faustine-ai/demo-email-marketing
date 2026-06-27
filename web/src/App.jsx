import { useEffect, useState, useCallback } from 'react';
import {
  Routes, Route, Navigate, NavLink, Outlet, useNavigate, useLocation, useParams, useOutletContext,
} from 'react-router-dom';
import { useStore } from './lib/hooks.js';
import { api, connect, logout as doLogout, fetchMe, getToken, setToken, disconnect, setUnauthorizedHandler } from './lib/store.js';
import { clockTime } from './lib/format.js';
import { getTheme, applyTheme } from './lib/theme.js';
import {
  IconPulse, IconCampaign, IconMailbox, IconAudience, IconTemplate, IconMenu, IconCheck,
  IconSettings, IconSun, IconMoon, IconLogout, IconUser,
} from './components/Icons.jsx';
import CampaignDrawer from './components/CampaignDrawer.jsx';
import Overview from './views/Overview.jsx';
import Campaigns from './views/Campaigns.jsx';
import Mailboxes from './views/Mailboxes.jsx';
import Audiences from './views/Audiences.jsx';
import Templates from './views/Templates.jsx';
import Settings from './views/Settings.jsx';
import Login from './views/Login.jsx';

const NAV = [
  { id: 'overview', label: 'Overview', icon: IconPulse, to: '/', end: true },
  { id: 'campaigns', label: 'Campaigns', icon: IconCampaign, to: '/campaigns' },
  { id: 'mailboxes', label: 'Mailboxes', icon: IconMailbox, to: '/mailboxes' },
  { id: 'audiences', label: 'Audiences', icon: IconAudience, to: '/audiences' },
  { id: 'templates', label: 'Templates', icon: IconTemplate, to: '/templates' },
  { id: 'settings', label: 'Settings', icon: IconSettings, to: '/settings' },
];

export default function App() {
  // auth: 'undefined' until we know, then a user object or null.
  const [user, setUser] = useState(undefined);

  // On boot, validate any token already in sessionStorage.
  useEffect(() => {
    let cancelled = false;
    // A rejected/expired token anywhere (REST 401 or WS 4401) bounces to login.
    setUnauthorizedHandler(() => {
      setToken(null);
      disconnect();
      setUser(null);
    });
    (async () => {
      if (!getToken()) {
        setUser(null);
        return;
      }
      const me = await fetchMe();
      if (cancelled) return;
      if (me) {
        connect();
        setUser(me);
      } else {
        setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onAuthed = useCallback((u) => {
    connect();
    setUser(u);
  }, []);

  if (user === undefined) return <div className="boot" />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onAuthed={onAuthed} />} />
      <Route
        element={
          user ? (
            <Console user={user} onLogout={() => { doLogout(); setUser(null); }} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<OverviewRoute />} />
        <Route path="overview" element={<Navigate to="/" replace />} />
        <Route path="campaigns" element={<CampaignsRoute />} />
        <Route path="campaigns/:id" element={<CampaignDetailRoute />} />
        <Route path="mailboxes" element={<MailboxesRoute />} />
        <Route path="audiences" element={<AudiencesRoute />} />
        <Route path="templates" element={<TemplatesRoute />} />
        <Route path="settings" element={<SettingsRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

// ---- route elements: pull shared deps from the layout's Outlet context ----
function OverviewRoute() {
  const { store, openCampaign } = useOutletContext();
  return <Overview store={store} onOpenCampaign={openCampaign} />;
}
function CampaignsRoute() {
  const { store, toast, openNewCampaign } = useOutletContext();
  const navigate = useNavigate();
  return (
    <Campaigns store={store} api={api} selectedId={null} onSelect={(id) => navigate(`/campaigns/${id}`)} onNew={openNewCampaign} toast={toast} />
  );
}
function CampaignDetailRoute() {
  const { store, toast, openNewCampaign } = useOutletContext();
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <Campaigns
      store={store}
      api={api}
      selectedId={id}
      onSelect={(v) => navigate(v ? `/campaigns/${v}` : '/campaigns')}
      onNew={openNewCampaign}
      toast={toast}
    />
  );
}
function MailboxesRoute() {
  const { store, toast } = useOutletContext();
  return <Mailboxes store={store} api={api} toast={toast} />;
}
function AudiencesRoute() {
  const { store, toast } = useOutletContext();
  return <Audiences store={store} api={api} toast={toast} />;
}
function TemplatesRoute() {
  const { store, toast } = useOutletContext();
  return <Templates store={store} api={api} toast={toast} />;
}
function SettingsRoute() {
  const { store, toast } = useOutletContext();
  return <Settings store={store} api={api} toast={toast} />;
}

function Console({ user, onLogout }) {
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(getTheme);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  const toast = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const openCampaign = useCallback((id) => navigate(`/campaigns/${id}`), [navigate]);

  const counts = {
    campaigns: store.campaigns.length,
    mailboxes: store.mailboxes.length,
    audiences: store.audiences.length,
    templates: store.templates.length,
  };

  const sending = store.campaigns.filter((c) => c.status === 'sending');
  const liveRate = sending.reduce((s, c) => s + c.sendRate, 0) * 3;

  // Page title / breadcrumb derived from the current URL.
  const onCampaignDetail = /^\/campaigns\/[^/]+$/.test(location.pathname);
  const navMatch = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
  const title = onCampaignDetail ? 'Campaign detail' : navMatch?.label || 'Overview';
  const crumb = onCampaignDetail ? 'Campaigns / Detail' : navMatch?.label || 'Overview';

  return (
    <div className="app">
      <Rail counts={counts} connection={store.connection} clients={store.clients} open={railOpen} onNavigate={() => setRailOpen(false)} user={user} onLogout={onLogout} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setRailOpen((v) => !v)} aria-label="Menu">
            <IconMenu />
          </button>
          <div>
            <span className="crumb">{crumb}</span>
            <h1>{title}</h1>
          </div>
          <div className="spacer" />
          <Telemetry sending={sending.length} liveRate={liveRate} />
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </header>

        <main className="view">
          <Outlet context={{ store, api, toast, openCampaign, openNewCampaign: () => setDrawer(true) }} />
        </main>
      </div>

      {drawer && (
        <CampaignDrawer
          store={store}
          api={api}
          onClose={() => setDrawer(false)}
          onCreated={(c) => {
            setDrawer(false);
            toast('Draft created');
            openCampaign(c.id);
          }}
        />
      )}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <IconCheck style={{ width: 16, height: 16, color: 'var(--mint)' }} />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function Rail({ counts, connection, clients, open, onNavigate, user, onLogout }) {
  const label = { open: 'Connected', connecting: 'Connecting…', closed: 'Reconnecting…' }[connection] || connection;
  return (
    <aside className={`rail${open ? ' open' : ''}`}>
      <div className="brand">
        <span className="mark">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M6 21 L13 9 L17.5 17 L20.5 12 L26 21" stroke="var(--coral)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <div className="name">RELAY</div>
          <div className="sub">dispatch console</div>
        </div>
      </div>

      <div className="nav-label">Workspace</div>
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <NavLink
            key={n.id}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <Icon />
            {n.label}
            {counts[n.id] != null && <span className="count">{counts[n.id]}</span>}
          </NavLink>
        );
      })}

      <div className="rail-foot">
        <div className="user-row">
          <span className="user-avatar"><IconUser style={{ width: 16, height: 16 }} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{user.name}</div>
            <div className="user-handle">@{user.username}</div>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Sign out" aria-label="Sign out">
            <IconLogout />
          </button>
        </div>
        <div className={`conn ${connection}`}>
          <span className="dot" />
          {label} · {clients} session{clients === 1 ? '' : 's'}
        </div>
      </div>
    </aside>
  );
}

function Telemetry({ sending, liveRate }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="row" style={{ gap: 12 }}>
      <div className="tele hide-sm">
        <span className="live-dot" style={{ background: sending ? 'var(--coral)' : 'var(--mist)' }} />
        <b>{sending}</b> dispatching · <b>{liveRate}</b>/s
      </div>
      <div className="tele">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{clockTime(now)}</span>
      </div>
    </div>
  );
}
