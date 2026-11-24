import React, { useState } from 'react';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, CertBadge, Empty, IconButton, PageHead, SearchInput, SkeletonRows, StatusBadge, Tabs, cx } from '../ui';
import { ROLE_PRECEDENCE, ROLE_LABELS, CERT_LEVELS } from '../../lib/roles';
import { oEmail, oName, totalHours } from '../../lib/format';

const People = ({ ctx }) => {
  const { profiles, saving, actions, loading, user } = ctx;
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const rows = profiles.filter(p => !s || [p.full_name, p.email].some(f => (f || '').toLowerCase().includes(s)));
  return (
    <>
      <div className="toolbar"><SearchInput value={q} onChange={setQ} placeholder={`Search ${profiles.length} people…`} /></div>
      <Card>
        {loading ? <SkeletonRows rows={6} /> : rows.length === 0 ? <Empty icon={Icons.Users} title="No one matches" /> : rows.map(p => {
          const held = p.roles || (p.role ? [p.role] : []);
          return (
            <div className="list-row row wrap" key={p.id} style={{ rowGap: 10 }}>
              <Avatar name={p.full_name} src={p.avatar_url} />
              <div className="grow" style={{ minWidth: 180 }}>
                <div className="strong truncate">{p.full_name || 'Unnamed'}{p.id === user.id && <span className="muted"> (you)</span>}</div>
                <div className="tiny muted truncate">{p.email}</div>
              </div>
              <div className="chips" role="group" aria-label={`Roles for ${p.full_name}`}>
                {ROLE_PRECEDENCE.map(r => {
                  const on = held.includes(r);
                  return <button key={r} type="button" disabled={saving} aria-pressed={on} className={cx('chip', on && 'on')} style={{ height: 28, padding: '0 10px' }} onClick={() => actions.setRoles(p, on ? held.filter(x => x !== r) : [...held, r])}>{ROLE_LABELS[r]}</button>;
                })}
              </div>
              <select className="select" style={{ width: 150, height: 34 }} value={p.cert_level || ''} disabled={saving} onChange={e => actions.setCert(p, e.target.value || null)} aria-label={`Certification for ${p.full_name}`}>
                <option value="">No cert level</option>{CERT_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          );
        })}
      </Card>
    </>
  );
};

const Orientees = ({ ctx }) => {
  const { orientees, loading, open, actions } = ctx;
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const s = q.trim().toLowerCase();
  const rows = orientees.filter(o => Boolean(o.is_archived) === archived).filter(o => !s || [oName(o), oEmail(o)].some(f => (f || '').toLowerCase().includes(s)));
  return (
    <>
      <div className="toolbar">
        <Tabs label="Archived filter" value={archived ? 'archived' : 'current'} onChange={v => setArchived(v === 'archived')} options={[{ value: 'current', label: 'Current', count: orientees.filter(o => !o.is_archived).length }, { value: 'archived', label: 'Archived', count: orientees.filter(o => o.is_archived).length }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search orientees…" />
        <Button icon={Icons.Plus} onClick={() => open('addOrientee')}>Add orientee</Button>
      </div>
      <Card className="table-wrap">
        {loading ? <SkeletonRows rows={5} /> : rows.length === 0 ? <Empty icon={Icons.Users} title={archived ? 'Nothing archived' : 'No orientees'}>{archived ? 'Archived orientees keep their records and can be restored here.' : undefined}</Empty> : (
          <table className="table stackable">
            <thead><tr><th>Orientee</th><th>Cert</th><th>Lead FTO</th><th>Status</th><th>Hours</th><th>Account</th><th className="num">Actions</th></tr></thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.id}>
                  <td className="primary"><div className="row"><Avatar name={oName(o)} size="sm" /><div><div className="strong">{oName(o)}</div><div className="tiny muted">{oEmail(o) || 'No email'}</div></div></div></td>
                  <td data-label="Cert"><CertBadge level={o.cert_level} /></td>
                  <td data-label="Lead FTO">{o.lead_fto?.full_name || <span className="muted">Unassigned</span>}</td>
                  <td data-label="Status"><StatusBadge status={o.status} /></td>
                  <td data-label="Hours" style={{ whiteSpace: 'nowrap' }}>{o.hours_completed || 0}/{totalHours(o)}h{o.hours_adjustment ? <span className="tiny muted"> ({o.hours_adjustment > 0 ? '+' : ''}{o.hours_adjustment})</span> : null}</td>
                  <td data-label="Account">{o.user_id ? <Badge tone="success" dot>Linked</Badge> : <Badge tone="warning" dot>Not linked</Badge>}</td>
                  <td className="num" data-label="Actions">
                    <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      {archived ? <Button size="sm" variant="secondary" icon={Icons.Refresh} onClick={() => actions.restoreOrientee(o)}>Restore</Button> : (
                        <>
                          <IconButton label={`Edit ${oName(o)}`} icon={Icons.Edit} variant="secondary" size="sm" onClick={() => open('editOrientee', o)} />
                          <IconButton label={`Adjust hours for ${oName(o)}`} icon={Icons.Sliders} variant="secondary" size="sm" onClick={() => open('adjustHours', o)} />
                          <IconButton label={`Archive ${oName(o)}`} icon={Icons.Archive} variant="danger" size="sm" onClick={() => actions.archiveOrientee(o)} />
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
};

export default function AdminView({ ctx }) {
  const [tab, setTab] = useState('people');
  return (
    <div className="page">
      <PageHead title="Admin" sub="Roles, certification levels and orientee records.">
        <Tabs label="Admin sections" value={tab} onChange={setTab} options={[{ value: 'people', label: 'People & roles', icon: Icons.Shield }, { value: 'orientees', label: 'Orientees', icon: Icons.Users }]} />
      </PageHead>
      {tab === 'people' ? <People ctx={ctx} /> : <Orientees ctx={ctx} />}
    </div>
  );
}
