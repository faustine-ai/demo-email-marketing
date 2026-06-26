// The signature element: a telemetry lane where each dispatched email flies
// across as a colored packet (delivered / open / click / bounce), fed live
// from the server's WebSocket "dispatch" messages.

function hash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h;
}

export default function DispatchStream({ packets, campaigns, campaignId, height = 132 }) {
  const sending = campaigns.filter((c) => c.status === 'sending' && (!campaignId || c.id === campaignId));
  const rate = sending.reduce((s, c) => s + c.sendRate, 0);

  const shown = (campaignId ? packets.filter((p) => p.campaignId === campaignId) : packets).slice(0, 44);

  const legend = [
    ['delivered', 'var(--mint)', 'delivered'],
    ['open', 'var(--violet)', 'opened'],
    ['click', 'var(--coral)', 'clicked'],
    ['bounce', 'var(--amber)', 'bounced'],
  ];

  return (
    <div className="stream">
      <div className="stream-head">
        <span className="title">Dispatch stream</span>
        <span className="badge live" style={{ color: rate ? 'var(--coral)' : 'var(--mist)' }}>
          <span className="led" />
          {rate ? 'live' : 'idle'}
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="rate">{rate ? `≈ ${rate * 3}/s` : '0/s'}</span>
      </div>

      <div className="stream-lane" style={{ height }}>
        <div className="axis" />
        {shown.length === 0 && <div className="stream-empty">awaiting dispatch</div>}
        {shown.map((p) => {
          const h = hash(p.id);
          const top = 12 + (h % 76);
          const dur = 1.5 + ((h >> 3) % 12) / 10; // 1.5s – 2.6s
          return (
            <span
              key={p.id}
              className={`packet ${p.kind}`}
              style={{ top: `${top}%`, animationDuration: `${dur}s` }}
            />
          );
        })}
      </div>

      <div className="stream-legend">
        {legend.map(([k, c, label]) => (
          <span key={k}>
            <i style={{ background: c }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
