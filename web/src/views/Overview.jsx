import DispatchStream from '../components/DispatchStream.jsx';
import { StatTile, StatusBadge, Meter } from '../components/ui.jsx';
import { num, compact, pct, ratio, relTime, STATUS } from '../lib/format.js';

export default function Overview({ store, onOpenCampaign }) {
  const { campaigns, mailboxes, audiences, activity, dispatch } = store;

  const agg = campaigns.reduce(
    (a, c) => {
      a.sent += c.metrics.sent;
      a.delivered += c.metrics.delivered;
      a.opened += c.metrics.opened;
      a.clicked += c.metrics.clicked;
      return a;
    },
    { sent: 0, delivered: 0, opened: 0, clicked: 0 }
  );
  const sending = campaigns.filter((c) => c.status === 'sending');
  const reach = audiences.reduce((s, a) => s + a.size, 0);
  const liveRows = campaigns
    .filter((c) => c.status === 'sending' || c.status === 'scheduled' || c.status === 'paused')
    .sort((a, b) => (a.status === 'sending' ? -1 : 1));

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div className="grid cols-4">
        <StatTile label="Delivered" value={compact(agg.delivered)} delta={<span className="up">▲ 3.2% vs last run</span>} accent="var(--mint)" seed={3} />
        <StatTile label="Open rate" value={pct(agg.opened, agg.delivered, 1)} delta={<span className="up">▲ healthy</span>} accent="var(--violet)" seed={7} />
        <StatTile label="Active sends" value={num(sending.length)} delta={<span>{sending.length ? 'dispatching now' : 'all quiet'}</span>} accent="var(--coral)" seed={11} />
        <StatTile label="Audience reach" value={compact(reach)} delta={<span>{num(audiences.length)} segments</span>} accent="var(--mist)" seed={5} />
      </div>

      <DispatchStream packets={dispatch} campaigns={campaigns} height={150} />

      <div className="detail-grid">
        <div className="panel panel-pad">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <span className="eyebrow">In flight</span>
            <h2>Live & queued campaigns</h2>
          </div>
          {liveRows.length === 0 ? (
            <div className="empty">
              <div className="big">Nothing in flight</div>
              <div>Launch a campaign to light up the stream.</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}>Progress</th>
                  <th className="num">Delivered</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((c) => {
                  const r = ratio(c.metrics.sent, c.metrics.recipients);
                  return (
                    <tr key={c.id} onClick={() => onOpenCampaign(c.id)}>
                      <td>
                        <div className="t-name">{c.name}</div>
                        <div className="t-sub">{c.subject}</div>
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <Meter value={r} color={STATUS[c.status]?.color} thin />
                        <div className="mono-tag" style={{ marginTop: 6 }}>
                          {pct(c.metrics.sent, c.metrics.recipients, 0)} · {compact(c.metrics.sent)}/{compact(c.metrics.recipients)}
                        </div>
                      </td>
                      <td className="num">{num(c.metrics.delivered)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel panel-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <span className="eyebrow">Telemetry</span>
            <h2>Activity</h2>
          </div>
          <div className="feed" style={{ overflowY: 'auto', maxHeight: 360 }}>
            {activity.map((e) => (
              <div key={e.id} className={`feed-item ${e.severity}`}>
                <span className="tick" />
                <span className="msg">{e.message}</span>
                <span className="when">{relTime(e.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="section-head" style={{ marginBottom: 14 }}>
          <span className="eyebrow">Infrastructure</span>
          <h2>Mailbox health</h2>
        </div>
        <div className="grid cols-4">
          {mailboxes.map((m) => (
            <div key={m.id} className="card" style={{ padding: 14 }}>
              <div className="mono" style={{ fontSize: 12 }}>{m.address}</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>{m.reputation}</div>
                  <div className="mono-tag">reputation</div>
                </div>
                <StatusBadge status={m.status === 'active' ? 'sent' : m.status === 'paused' ? 'paused' : 'scheduled'} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Meter value={m.sentToday / m.dailyLimit} color={m.reputation > 80 ? 'var(--mint)' : 'var(--amber)'} thin />
                <div className="mono-tag" style={{ marginTop: 6 }}>
                  {num(m.sentToday)} / {num(m.dailyLimit)} today
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
