import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../lib/backend';
import { Icons } from '../Icons';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Modal, SearchInput, SkeletonRows, cx, useFeedback } from '../ui';
import { dayLabel, fmtTime } from '../../lib/format';

const POLL_MS = 20000;

const titleOf = (c, userId) => {
  if (!c) return '';
  if (c.is_group) return c.name || 'Group';
  const others = (c.participants || []).map(p => p.user).filter(u => u && u.id !== userId).map(u => u.full_name || 'Unknown');
  return others.join(' & ') || 'Conversation';
};

const NewConversation = ({ profiles, userId, onClose, onCreate }) => {
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const s = q.trim().toLowerCase();
  const people = profiles.filter(p => p.id !== userId).filter(p => !s || [p.full_name, p.email].some(f => (f || '').toLowerCase().includes(s)));
  const toggle = (id) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const go = async () => { setBusy(true); await onCreate(picked, name); setBusy(false); };
  return (
    <Modal onClose={onClose} title="New conversation">
      <SearchInput value={q} onChange={setQ} placeholder="Find someone…" />
      <div className="card" style={{ maxHeight: 260, overflow: 'auto', margin: '12px 0' }}>
        {people.length === 0 ? <div className="empty" style={{ padding: 24 }}>No one found.</div> : people.map(p => {
          const on = picked.includes(p.id);
          return (
            <button type="button" key={p.id} className="list-row" aria-pressed={on} onClick={() => toggle(p.id)} style={on ? { background: 'var(--brand-soft)' } : undefined}>
              <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
              <span className="grow truncate">{p.full_name || p.email || 'Unknown user'}</span>
              {on && <Icons.CheckCircle size={18} color="var(--brand-fg)" />}
            </button>
          );
        })}
      </div>
      {picked.length > 1 && <Field label="Group name"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. B Shift FTOs" /></Field>}
      <Button block loading={busy} disabled={!picked.length} onClick={go}>{picked.length > 1 ? `Start group with ${picked.length} people` : 'Start conversation'}</Button>
    </Modal>
  );
};

export default function MessagesView({ ctx }) {
  const { user, role, profiles, refreshUnread } = ctx;
  const userId = user.id;
  const feedback = useFeedback();
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text }
  const [renaming, setRenaming] = useState(null); // string while editing the group name
  const [q, setQ] = useState('');
  const endRef = useRef(null);
  const selectedId = selected?.id;

  const loadConvos = useCallback(async () => {
    // Admins can see every conversation for oversight.
    const { data, error } = role === 'admin' ? await db.getAllConversations() : await db.getConversations(userId);
    if (error) feedback.error('Could not load conversations.');
    setConvos((data || []).filter(Boolean));
    setLoading(false);
  }, [role, userId, feedback]);

  const loadMessages = useCallback(async (id) => {
    const { data } = await db.getMessages(id);
    setMessages(prev => (data && (data.length !== prev.length || data[data.length - 1]?.id !== prev[prev.length - 1]?.id || data.some((m, i) => m.content !== prev[i]?.content)) ? data : prev));
  }, []);

  useEffect(() => { loadConvos(); }, [loadConvos]);

  useEffect(() => {
    if (!selectedId) return undefined;
    setMessages([]);
    setEditing(null); setRenaming(null);
    const sync = async () => { await loadMessages(selectedId); await db.markConversationRead(userId, selectedId); refreshUnread(); };
    sync();
    const timer = setInterval(() => { if (!document.hidden) sync(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [selectedId, userId, loadMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    const { error } = await db.sendMessage(selected.id, userId, text);
    setSending(false);
    if (error) return feedback.error('Message not sent: ' + error.message);
    setDraft('');
    loadMessages(selected.id);
  };

  const create = async (ids, groupName) => {
    const isGroup = ids.length > 1;
    const { data, error } = await db.createConversation(isGroup ? (groupName.trim() || 'Group') : null, isGroup, userId, [userId, ...ids]);
    if (error || !data) return feedback.error('Could not start the conversation.');
    setShowNew(false);
    await loadConvos();
    setSelected({ ...data, participants: [userId, ...ids].map(id => ({ user: profiles.find(p => p.id === id) || { id } })) });
  };

  const remove = (c) => feedback.confirm({
    title: 'Delete conversation?', tone: 'danger', confirmLabel: 'Delete',
    message: `This permanently deletes “${titleOf(c, userId)}” and all of its messages for everyone.`,
    onConfirm: async () => {
      const { error } = await db.deleteConversation(c.id, userId);
      if (error) return feedback.error('Could not delete: ' + error.message);
      setConvos(list => list.filter(x => x.id !== c.id));
      if (selectedId === c.id) setSelected(null);
    },
  });

  const saveEdit = async () => {
    if (!editing?.text.trim()) return;
    const { error } = await db.updateMessage(editing.id, editing.text.trim());
    if (error) return feedback.error('Could not save the edit.');
    setEditing(null);
    loadMessages(selected.id);
  };

  const rename = async (e) => {
    e.preventDefault();
    const name = (renaming || '').trim();
    if (!name) return;
    const { error } = await db.updateConversation(selected.id, { name });
    if (error) return feedback.error('Could not rename the group.');
    setSelected(sel => ({ ...sel, name }));
    setConvos(list => list.map(c => (c.id === selected.id ? { ...c, name } : c)));
    setRenaming(null);
  };

  const s = q.trim().toLowerCase();
  const shown = convos.filter(c => !s || titleOf(c, userId).toLowerCase().includes(s));
  let lastDay = null;

  return (
    <div className="page">
      <Card className={cx('chat', selected && 'thread-open')}>
        <div className="chat-list">
          <div className="card-head"><h1 className="card-title" style={{ fontSize: 17 }}>Messages</h1><IconButton label="New conversation" icon={Icons.Plus} variant="primary" size="sm" onClick={() => setShowNew(true)} /></div>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}><SearchInput value={q} onChange={setQ} placeholder="Search conversations…" /></div>
          <div className="chat-scroll">
            {loading ? <SkeletonRows rows={4} /> : shown.length === 0 ? (
              <Empty icon={Icons.MessageCircle} title={s ? 'No matches' : 'No conversations yet'} action={!s && <Button size="sm" icon={Icons.Plus} onClick={() => setShowNew(true)}>Start one</Button>} />
            ) : shown.map(c => (
              <div key={c.id} className={cx('convo', selectedId === c.id && 'on')} role="button" tabIndex={0} onClick={() => setSelected(c)} onKeyDown={e => e.key === 'Enter' && setSelected(c)}>
                {c.is_group ? <span className="avatar"><Icons.Users size={17} /></span> : <Avatar name={titleOf(c, userId)} />}
                <div className="grow"><div className="strong truncate">{titleOf(c, userId)}</div><div className="tiny muted">{c.is_group ? `${c.participants?.length || 0} people` : 'Direct message'}</div></div>
                <button type="button" className="convo-del" aria-label={`Delete conversation ${titleOf(c, userId)}`} onClick={e => { e.stopPropagation(); remove(c); }}><Icons.Trash size={15} /></button>
              </div>
            ))}
          </div>
          {role === 'admin' && <div className="tiny muted row" style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', gap: 6 }}><Badge tone="neutral">Admin</Badge>Showing every conversation in the agency.</div>}
        </div>

        <div className="chat-thread">
          {!selected ? <div style={{ margin: 'auto' }}><Empty icon={Icons.MessageCircle} title="Pick a conversation">Or start a new one with the + button.</Empty></div> : (
            <>
              <div className="card-head">
                {renaming !== null ? (
                  <form className="row grow" onSubmit={rename}>
                    <input className="input" autoFocus value={renaming} onChange={e => setRenaming(e.target.value)} aria-label="Group name" />
                    <Button type="submit" size="sm">Save</Button><Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
                  </form>
                ) : (
                  <>
                    <div className="row grow">
                      <span className="chat-back"><IconButton label="Back to conversations" icon={Icons.ArrowLeft} size="sm" onClick={() => setSelected(null)} /></span>
                      <div className="grow"><div className="card-title truncate">{titleOf(selected, userId)}</div>{selected.is_group && <div className="tiny muted truncate">{(selected.participants || []).map(p => p.user?.full_name).filter(Boolean).join(', ')}</div>}</div>
                    </div>
                    {selected.is_group && <IconButton label="Rename group" icon={Icons.Edit} size="sm" onClick={() => setRenaming(selected.name || '')} />}
                  </>
                )}
              </div>
              <div className="msgs" aria-live="polite">
                {messages.length === 0 && <div className="muted small" style={{ margin: 'auto' }}>No messages yet. Say hello.</div>}
                {messages.map((m, i) => {
                  const mine = m.sender_id === userId;
                  const day = dayLabel(m.created_at);
                  const showDay = day !== lastDay; lastDay = day;
                  const next = messages[i + 1];
                  const endOfRun = !next || next.sender_id !== m.sender_id || dayLabel(next.created_at) !== day;
                  return (
                    <React.Fragment key={m.id}>
                      {showDay && <div className="day-sep">{day}</div>}
                      <div className={cx('msg', mine && 'me')}>
                        {editing?.id === m.id ? (
                          <form className="row" onSubmit={e => { e.preventDefault(); saveEdit(); }}>
                            <input className="input" autoFocus value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} aria-label="Edit message" style={{ minWidth: 220 }} />
                            <Button type="submit" size="sm">Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                          </form>
                        ) : <div className="bubble">{m.content}</div>}
                        {endOfRun && editing?.id !== m.id && (
                          <div className="msg-meta">
                            {!mine && <span>{m.sender?.full_name || 'Unknown'}</span>}<span>{fmtTime(m.created_at)}</span>{m.edited_at && <span>edited</span>}
                            {mine && <button type="button" className="link-btn msg-edit tiny" onClick={() => setEditing({ id: m.id, text: m.content })}>Edit</button>}
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={endRef} />
              </div>
              <form className="composer" onSubmit={send}>
                <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" aria-label="Message" maxLength={4000} />
                <Button type="submit" icon={Icons.Send} loading={sending} disabled={!draft.trim()} aria-label="Send" />
              </form>
            </>
          )}
        </div>
      </Card>
      {showNew && <NewConversation profiles={profiles} userId={userId} onClose={() => setShowNew(false)} onCreate={create} />}
    </div>
  );
}
