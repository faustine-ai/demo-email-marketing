import { useEffect, useState, useCallback } from 'react';
import { useStore } from './lib/hooks.js';
import { api } from './lib/store.js';
import { clockTime } from './lib/format.js';
import {
  IconPulse, IconCampaign, IconMailbox, IconAudience, IconTemplate, IconMenu, IconCheck,
} from './components/Icons.jsx';
import CampaignDrawer from './components/CampaignDrawer.jsx';
import Overview from './views/Overview.jsx';
import Campaigns from './views/Campaigns.jsx';
import Mailboxes from './views/Mailboxes.jsx';
import Audiences from './views/Audiences.jsx';
import Templates from './views/Templates.jsx';

const NAV = [
  { id: 'overview', label: 'Overview', icon: IconPulse },
  { id: 'campaigns', label: 'Campaigns', icon: IconCampaign },
  { id: 'mailboxes', label: 'Mailboxes', icon: IconMailbox },
  { id: 'audiences', label: 'Audiences', icon: IconAudience },
  { id: 'templates', label: 'Templates', icon: IconTemplate },
];

export default function App() {
  const store = useStore();
  const [route, setRoute] = useState('overview');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const go = (id) => {
    setRoute(id);
    setSelectedCampaign(null);
    setRailOpen(false);
  };

  const openCampaign = (id) => {
    setRoute('campaigns');
    setSelectedCampaign(id);
  };

  const counts = {
    campaigns: store.campaigns.length,
    mailboxes: store.mailboxes.length,
    audiences: store.audiences.length,
    templates: store.templates.length,
  };

  const sending = store.campaigns.filter((c) => c.status === 'sending');
  const liveRate = sending.reduce((s, c) => s + c.sendRate, 0) * 3;

  const crumb =
    route === 'campaigns' && selectedCampaign ? 'Campaigns / Detail' : NAV.find((n) => n.id === route)?.label;

  return (
    <div className="app">
      <Rail route={route} go={go} counts={counts} connection={store.connection} clients={store.clients} open={railOpen} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setRailOpen((v) => !v)} aria-label="Menu">
            <IconMenu />
          </button>
          <div>
            <span className="crumb">{crumb}</span>
            <h1>{route === 'campaigns' && selectedCampaign ? 'Campaign detail' : NAV.find((n) => n.id === route)?.label}</h1>
          </div>
          <div className="spacer" />
          <Telemetry sending={sending.length} liveRate={liveRate} />
        </header>

        <main className="view">
          {route === 'overview' && <Overview store={store} onOpenCampaign={openCampaign} />}
          {route === 'campaigns' && (
            <Campaigns
              store={store}
              api={api}
              selectedId={selectedCampaign}
              onSelect={setSelectedCampaign}
              onNew={() => setDrawer(true)}
              toast={toast}
            />
          )}
          {route === 'mailboxes' && <Mailboxes store={store} api={api} toast={toast} />}
          {route === 'audiences' && <Audiences store={store} api={api} toast={toast} />}
          {route === 'templates' && <Templates store={store} api={api} toast={toast} />}
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

function Rail({ route, go, counts, connection, clients, open }) {
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
          <button key={n.id} className={`nav-item${route === n.id ? ' active' : ''}`} onClick={() => go(n.id)}>
            <Icon />
            {n.label}
            {counts[n.id] != null && <span className="count">{counts[n.id]}</span>}
          </button>
        );
      })}

      <div className="rail-foot">
        <div className={`conn ${connection}`}>
          <span className="dot" />
          {label}
        </div>
        <div className="conn" style={{ paddingTop: 0 }}>
          <span style={{ width: 8 }} />
          {clients} session{clients === 1 ? '' : 's'} live
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
