import React from 'react';
import { Icons } from '../Icons';
import { Avatar, Card, CardHead, Empty, Modal, PageHead, Ring, SkeletonRows, Stars } from '../ui';
import { avg, fmtDate, oName } from '../../lib/format';

const DIMENSIONS = [['overall_rating', 'Overall'], ['communication_rating', 'Communication'], ['teaching_rating', 'Teaching'], ['support_rating', 'Support']];
const fmt = (n) => (n === null ? '—' : n.toFixed(1));

export default function FTOFeedbackView({ ctx }) {
  const { role, user, loading, ftoEvaluations, open } = ctx;
  const isAdmin = role === 'admin';
  const mine = ftoEvaluations.filter(e => e.fto_id === user.id);

  // FTOs see only their own headline number. Individual responses stay with admins
  // so orientees can be candid.
  if (!isAdmin) {
    const overall = avg(mine.map(e => e.overall_rating));
    return (
      <div className="page">
        <PageHead title="FTO feedback" sub="How orientees rate their time with you." />
        <Card className="card-body">
          <div className="row wrap" style={{ gap: 22 }}>
            <Ring value={overall ? (overall / 5) * 100 : 0} size={104} stroke={9} color="var(--star)"><b style={{ fontSize: 26 }}>{fmt(overall)}</b><span className="tiny muted">of 5</span></Ring>
            <div className="grow" style={{ minWidth: 220 }}>
              <h2 style={{ fontSize: 18 }}>Your feedback summary</h2>
              <p className="soft" style={{ marginTop: 4 }}>{mine.length === 0 ? 'No orientee has rated you yet.' : `Based on ${mine.length} response${mine.length === 1 ? '' : 's'} from orientees.`}</p>
              <p className="small muted" style={{ marginTop: 8 }}><Icons.Shield size={13} style={{ verticalAlign: '-2px' }} /> Individual responses and comments are visible to administrators only.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const byFto = Object.values(ftoEvaluations.reduce((acc, e) => {
    (acc[e.fto_id] = acc[e.fto_id] || { fto: e.fto, id: e.fto_id, rows: [] }).rows.push(e);
    return acc;
  }, {})).sort((a, b) => (a.fto?.full_name || '').localeCompare(b.fto?.full_name || ''));

  return (
    <div className="page">
      <PageHead title="FTO feedback" sub="Ratings orientees give their field training officers. FTOs see only their own overall average." />
      {!loading && byFto.length > 0 && (
        <div className="grid cols-auto" style={{ marginBottom: 16 }}>
          {byFto.map(g => (
            <Card key={g.id} className="card-body">
              <div className="row" style={{ marginBottom: 14 }}>
                <Avatar name={g.fto?.full_name} />
                <div className="grow"><div className="strong truncate">{g.fto?.full_name || 'Unknown'}</div><div className="tiny muted">{g.rows.length} response{g.rows.length === 1 ? '' : 's'}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>{fmt(avg(g.rows.map(r => r.overall_rating)))}</div></div>
              </div>
              <div className="stack tight">
                {DIMENSIONS.slice(1).map(([key, label]) => {
                  const v = avg(g.rows.map(r => r[key]));
                  return <div className="row small" key={key}><span className="soft" style={{ width: 110 }}>{label}</span><div className="progress grow"><i style={{ width: ((v || 0) / 5) * 100 + '%', background: 'var(--star)' }} /></div><span className="strong" style={{ width: 28, textAlign: 'right' }}>{fmt(v)}</span></div>;
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Card className="table-wrap">
        <CardHead title="All responses" icon={Icons.ThumbsUp} />
        {loading ? <SkeletonRows rows={5} /> : ftoEvaluations.length === 0 ? <Empty icon={Icons.ThumbsUp} title="No feedback yet">Orientees can rate their FTO from the Evaluations page.</Empty> : (
          <table className="table stackable">
            <thead><tr><th>Date</th><th>FTO</th><th>From</th>{DIMENSIONS.map(([k, l]) => <th key={k}>{l}</th>)}<th aria-label="Open" /></tr></thead>
            <tbody>
              {ftoEvaluations.map(ev => (
                <tr key={ev.id} className="clickable" tabIndex={0} onClick={() => open('ftoEval', ev)} onKeyDown={e => e.key === 'Enter' && open('ftoEval', ev)}>
                  <td data-label="Date" className="soft" style={{ whiteSpace: 'nowrap' }}>{fmtDate(ev.shift_date)}</td>
                  <td className="primary strong">{ev.fto?.full_name || '—'}</td>
                  <td data-label="From">{oName(ev.orientee)}</td>
                  {DIMENSIONS.map(([k, l]) => <td key={k} data-label={l}><Stars value={ev[k]} size={12} /></td>)}
                  <td className="num hide-stack"><Icons.ChevronRight size={16} className="muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function FTOEvalDetailModal({ evaluation: ev, onClose }) {
  return (
    <Modal onClose={onClose} title="FTO feedback" width={500}>
      <div className="row between" style={{ marginBottom: 18, alignItems: 'flex-start' }}>
        <div className="row"><Avatar name={ev.fto?.full_name} size="lg" /><div><h3 style={{ fontSize: 18 }}>{ev.fto?.full_name || 'Unknown'}</h3><div className="small soft">From {oName(ev.orientee)}</div></div></div>
        <div className="strong">{fmtDate(ev.shift_date)}</div>
      </div>
      <div className="grid cols-2" style={{ gap: 8, marginBottom: 16 }}>
        {DIMENSIONS.map(([key, label]) => <div className="tile" key={key} style={{ textAlign: 'left' }}><span>{label}</span><div style={{ marginTop: 4 }}><Stars value={ev[key]} size={17} /></div></div>)}
      </div>
      {ev.feedback ? <><div className="label">Written feedback</div><div className="tile" style={{ textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: 14 }}>{ev.feedback}</div></> : <p className="soft">No written feedback.</p>}
    </Modal>
  );
}
