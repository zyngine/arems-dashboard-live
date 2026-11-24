import React from 'react';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, CardHead, Empty, PageHead, Progress, Ring, Skeleton, SkeletonRows, Stars, StatCard } from '../ui';
import { MessagesWidget, OrienteeCard, PhaseSteps, attentionReasons } from './shared';
import { PHASES, daysFromToday, fmtDate, fmtRelative, getPhase, greeting, isActiveOrientee, materialType, oName, phaseInfo, progressPct, safeUrl, totalHours } from '../../lib/format';

const firstName = (profile) => (profile?.full_name || '').split(' ')[0];
const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const TrainingProgress = ({ materials, completions, go }) => {
  const done = new Set(completions.map(c => c.material_id));
  const todo = materials.filter(m => !done.has(m.id));
  const pct = materials.length ? Math.round(((materials.length - todo.length) / materials.length) * 100) : 0;
  return (
    <Card>
      <CardHead title="Your training" icon={Icons.GraduationCap}><button type="button" className="link-btn" onClick={() => go('training')}>Open library</button></CardHead>
      <div className="card-body">
        <div className="row between small" style={{ marginBottom: 8 }}><span className="soft">{materials.length - todo.length} of {materials.length} complete</span><span className="strong">{pct}%</span></div>
        <Progress value={pct} color="var(--success)" />
      </div>
      {todo.length === 0 ? (materials.length > 0 && <div className="card-body soft small" style={{ paddingTop: 0 }}>You are all caught up.</div>) : todo.slice(0, 4).map(m => {
        const t = materialType(m.type), I = Icons[t.icon];
        return (
          <button type="button" key={m.id} className="list-row" onClick={() => go('training')} style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            <span className={'type-icon tone-' + t.tone} style={{ width: 32, height: 32, borderRadius: 9 }}><I size={16} /></span>
            <span className="grow truncate small strong">{m.title}</span><Icons.ChevronRight size={16} className="muted" />
          </button>
        );
      })}
    </Card>
  );
};

const OrienteeHome = ({ ctx }) => {
  const { profile, myOrientee: o, myTasks, evaluations, materials, completions, recentMessages, go, open } = ctx;
  const ph = phaseInfo(getPhase(o.hours_completed));
  const tot = totalHours(o), left = Math.max(0, tot - (o.hours_completed || 0));
  const pending = myTasks.filter(t => t.status !== 'completed');
  const myEvals = evaluations.filter(e => e.orientee_id === o.id).slice(0, 4);
  const book = safeUrl(o.orientation_book_url);
  return (
    <div className="page">
      <PageHead title={`${greeting()}, ${firstName(profile)}`} sub={`${today()} · ${left > 0 ? `${left} hours to go` : 'All required hours logged'}`}>
        <Button variant="secondary" icon={Icons.Star} onClick={() => open('addFTOEval')}>Rate your FTO</Button>
      </PageHead>
      <div className="grid cols-main">
        <div className="stack loose">
          <Card className="card-body">
            <div className="row wrap" style={{ gap: 24 }}>
              <Ring value={progressPct(o)} size={132} color={ph.color}><b style={{ fontSize: 28, letterSpacing: '-0.02em' }}>{progressPct(o)}%</b><span className="tiny muted">complete</span></Ring>
              <div className="grow" style={{ minWidth: 200 }}>
                <Badge tone="neutral">Phase {ph.n} of 4</Badge>
                <h2 style={{ fontSize: 20, margin: '8px 0 4px', color: ph.color, letterSpacing: '-0.01em' }}>{ph.name}</h2>
                <p className="soft">{o.hours_completed || 0} of {tot} hours logged</p>
                <dl className="kv" style={{ marginTop: 14 }}>
                  <div><dt>Lead FTO</dt><dd>{o.lead_fto?.full_name || 'Not assigned'}</dd></div>
                  <div><dt>Station</dt><dd>{o.station || '—'}</dd></div>
                  <div><dt>Shift</dt><dd>{o.shift || '—'}</dd></div>
                  <div><dt>Target clear date</dt><dd>{fmtDate(o.tentative_clear_date)}</dd></div>
                </dl>
              </div>
            </div>
            <div style={{ marginTop: 20 }}><PhaseSteps hours={o.hours_completed} /></div>
          </Card>
          <Card>
            <CardHead title="Your tasks" icon={Icons.ListTodo}><button type="button" className="link-btn" onClick={() => go('tasks')}>View all</button></CardHead>
            {pending.length === 0 ? <Empty icon={Icons.CheckCircle} title="Nothing outstanding">Tasks your FTO assigns show up here.</Empty> : pending.slice(0, 5).map(t => {
              const due = daysFromToday(t.due_date);
              return (
                <div className="list-row" key={t.id}>
                  <div className="grow"><div className="strong">{t.title}</div>{t.description && <div className="small soft">{t.description}</div>}</div>
                  {t.due_date && <Badge tone={due < 0 ? 'danger' : due <= 2 ? 'warning' : 'neutral'}>{due < 0 ? 'Overdue' : 'Due'} {fmtRelative(t.due_date)}</Badge>}
                </div>
              );
            })}
          </Card>
          <Card>
            <CardHead title="Latest evaluations" icon={Icons.ClipboardCheck}><button type="button" className="link-btn" onClick={() => go('evaluations')}>View all</button></CardHead>
            {myEvals.length === 0 ? <Empty icon={Icons.ClipboardCheck} title="No evaluations yet">Your FTO files one after each shift.</Empty> : myEvals.map(ev => (
              <button type="button" className="list-row" key={ev.id} onClick={() => open('eval', ev)}>
                <div className="grow"><div className="strong">{fmtDate(ev.shift_date)} · {ev.hours_logged}h</div><div className="small soft truncate">{ev.improvements || ev.strengths || 'No notes'}</div></div>
                <span className="tiny muted">{ev.evaluator?.full_name}</span><Icons.ChevronRight size={16} className="muted" />
              </button>
            ))}
          </Card>
        </div>
        <div className="stack loose">
          {book && (
            <Card className="card-body">
              <div className="row"><span className="type-icon tone-brand"><Icons.FileText size={19} /></span><div className="grow"><div className="strong">Orientation book</div><div className="tiny muted">Your sign-off sheets and reference</div></div></div>
              <a className="btn btn-secondary btn-block" style={{ marginTop: 14 }} href={book} target="_blank" rel="noopener noreferrer"><Icons.ExternalLink size={15} />Open</a>
            </Card>
          )}
          <TrainingProgress materials={materials} completions={completions} go={go} />
          <MessagesWidget messages={recentMessages} onOpen={() => go('messages')} />
        </div>
      </div>
    </div>
  );
};

const EmployeeHome = ({ ctx }) => {
  const { profile, user, evaluations, materials, completions, go, open } = ctx;
  const mine = evaluations.filter(e => e.evaluator_id === user.id).slice(0, 5);
  return (
    <div className="page">
      <PageHead title={`${greeting()}, ${firstName(profile)}`} sub={today()}>
        <Button icon={Icons.Plus} onClick={() => open('addEval')}>New evaluation</Button>
      </PageHead>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <TrainingProgress materials={materials} completions={completions} go={go} />
        <Card>
          <CardHead title="Evaluations you filed" icon={Icons.ClipboardCheck}><button type="button" className="link-btn" onClick={() => go('evaluations')}>View all</button></CardHead>
          {mine.length === 0 ? <Empty icon={Icons.ClipboardCheck} title="None yet">Rode with an orientee? File a shift evaluation so their FTO sees it.</Empty> : mine.map(ev => (
            <button type="button" className="list-row" key={ev.id} onClick={() => open('eval', ev)}>
              <Avatar name={oName(ev.orientee)} size="sm" />
              <div className="grow"><div className="strong truncate">{oName(ev.orientee)}</div><div className="tiny muted">{fmtDate(ev.shift_date)} · {ev.hours_logged}h</div></div>
              <Stars value={ev.overall_rating} size={12} />
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
};

const StaffHome = ({ ctx }) => {
  const { profile, role, loading, orientees, evaluations, tasks, stats, recentMessages, go, open } = ctx;
  const active = orientees.filter(isActiveOrientee);
  const attention = active.map(o => ({ o, reasons: attentionReasons(o, tasks) })).filter(a => a.reasons.length);
  const byPhase = PHASES.map(p => ({ ...p, count: active.filter(o => getPhase(o.hours_completed) === p.n).length }));
  const toVerify = tasks.filter(t => t.status !== 'completed').length;
  return (
    <div className="page">
      <PageHead title={`${greeting()}, ${firstName(profile)}`} sub={`${today()} · ${active.length} active orientee${active.length === 1 ? '' : 's'}, ${toVerify} open task${toVerify === 1 ? '' : 's'}`}>
        {role === 'admin' && <Button variant="secondary" icon={Icons.Plus} onClick={() => open('addOrientee')}>Add orientee</Button>}
        <Button icon={Icons.ClipboardCheck} onClick={() => open('addEval')}>New evaluation</Button>
      </PageHead>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard icon={Icons.Users} label="Active orientees" value={stats.activeOrientees} tone="brand" loading={loading} onClick={() => go('orientees')} />
        <StatCard icon={Icons.AlertTriangle} label="At risk or extended" value={stats.atRiskCount} tone="warning" loading={loading} onClick={() => go('orientees')} />
        <StatCard icon={Icons.Award} label="Pending clearance" value={stats.pendingClearance} tone="success" loading={loading} onClick={() => go('orientees')} />
        <StatCard icon={Icons.TrendingUp} label="Average progress" value={stats.avgProgress + '%'} tone="violet" loading={loading} />
      </div>

      <div className="grid cols-main">
        <div className="stack loose">
          {attention.length > 0 && (
            <Card>
              <CardHead title="Needs attention" icon={Icons.AlertTriangle}><Badge tone="warning">{attention.length}</Badge></CardHead>
              {attention.map(({ o, reasons }) => (
                <button type="button" className="list-row" key={o.id} onClick={() => open('orientee', o)}>
                  <Avatar name={oName(o)} />
                  <div className="grow">
                    <div className="strong truncate">{oName(o)}</div>
                    <div className="row wrap" style={{ gap: 4, marginTop: 4 }}>{reasons.map(r => <Badge key={r.text} tone={r.tone}>{r.text}</Badge>)}</div>
                  </div>
                  <Icons.ChevronRight size={16} className="muted" />
                </button>
              ))}
            </Card>
          )}
          <Card>
            <CardHead title="Active orientees" icon={Icons.Users}><button type="button" className="link-btn" onClick={() => go('orientees')}>View roster</button></CardHead>
            {loading ? <SkeletonRows rows={3} /> : active.length === 0 ? (
              <Empty icon={Icons.Users} title="No active orientees" action={role === 'admin' && <Button size="sm" icon={Icons.Plus} onClick={() => open('addOrientee')}>Add orientee</Button>}>New hires in field training appear here.</Empty>
            ) : <div className="card-body grid cols-auto" style={{ gap: 12 }}>{active.map(o => <OrienteeCard key={o.id} o={o} onClick={() => open('orientee', o)} />)}</div>}
          </Card>
        </div>

        <div className="stack loose">
          <Card>
            <CardHead title="Phase pipeline" icon={Icons.Activity} />
            <div className="card-body">
              {loading ? <Skeleton h={10} /> : active.length === 0 ? <p className="soft small">No one in the programme right now.</p> : (
                <>
                  <div className="pipeline" role="img" aria-label={byPhase.map(p => `Phase ${p.n}: ${p.count}`).join(', ')}>
                    {byPhase.filter(p => p.count).map(p => <i key={p.n} style={{ flex: p.count, background: p.color }} />)}
                  </div>
                  <div className="legend">{byPhase.map(p => <div className="legend-item" key={p.n}><i style={{ background: p.color }} /><span className="truncate">{p.n} · {p.name}</span><b>{p.count}</b></div>)}</div>
                </>
              )}
            </div>
          </Card>
          <Card>
            <CardHead title="Recent evaluations" icon={Icons.ClipboardCheck}><button type="button" className="link-btn" onClick={() => go('evaluations')}>View all</button></CardHead>
            {loading ? <SkeletonRows rows={3} /> : evaluations.length === 0 ? <Empty icon={Icons.ClipboardCheck} title="No evaluations yet" /> : evaluations.slice(0, 5).map(ev => (
              <button type="button" className="list-row" key={ev.id} onClick={() => open('eval', ev)}>
                <div className="grow"><div className="strong small truncate">{oName(ev.orientee)}</div><div className="tiny muted truncate">{fmtRelative(ev.shift_date)} · {ev.evaluator?.full_name || 'Unknown'}</div></div>
                <Stars value={ev.overall_rating} size={12} />
              </button>
            ))}
          </Card>
          <MessagesWidget messages={recentMessages} onOpen={() => go('messages')} />
        </div>
      </div>
    </div>
  );
};

export default function DashboardView({ ctx }) {
  if (ctx.role === 'orientee' && ctx.myOrientee) return <OrienteeHome ctx={ctx} />;
  if (ctx.role === 'employee' || ctx.role === 'orientee') return <EmployeeHome ctx={ctx} />;
  return <StaffHome ctx={ctx} />;
}
