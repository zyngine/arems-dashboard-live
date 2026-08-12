import { supabase } from './supabase';

// Flattens the joined user_roles rows into a plain array so callers can use
// hasRole(profile, 'fto') without knowing the join shape.
const withRoles = (row) => {
  if (!row) return row;
  const { user_roles, ...rest } = row;
  return { ...rest, roles: (user_roles || []).map(r => r.role) };
};

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, user_roles(role)')
    .eq('id', userId)
    .single();
  return { data: withRoles(data), error };
};

export const getAllProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, user_roles(role)')
    .order('full_name');
  return { data: (data || []).map(withRoles), error };
};

export const updateProfile = async (userId, updates) => {
  // role and cert_level are not writable on this table; use setUserRoles /
  // setUserCertLevel. Strip them so a stray caller gets a no-op, not a 403.
  const { role, cert_level, roles, user_roles, ...safe } = updates;
  const { data, error } = await supabase
    .from('profiles')
    .update(safe)
    .eq('id', userId)
    .select('*, user_roles(role)')
    .single();
  return { data: withRoles(data), error };
};

export const setUserRoles = async (userId, roles) => {
  const { error } = await supabase.rpc('set_user_roles', {
    p_user_id: userId,
    p_roles: roles,
  });
  return { error };
};

export const setUserCertLevel = async (userId, certLevel) => {
  const { error } = await supabase.rpc('set_user_cert_level', {
    p_user_id: userId,
    p_cert_level: certLevel,
  });
  return { error };
};

export const getFTOs = async () => {
  const { data, error } = await supabase.from('profiles').select('*').in('role', ['fto', 'lead_fto', 'admin']).order('full_name');
  return { data, error };
};

export const getOrientees = async () => {
  const { data, error } = await supabase.from('orientees').select(`*, lead_fto:profiles!orientees_lead_fto_id_fkey(id, full_name, email), user:profiles!orientees_user_id_fkey(id, full_name, email, phone)`).order('created_at', { ascending: false });
  return { data, error };
};

export const getOrienteeByUserId = async (userId) => {
  const { data, error } = await supabase.from('orientees').select(`*, lead_fto:profiles!orientees_lead_fto_id_fkey(id, full_name, email, phone)`).eq('user_id', userId).single();
  return { data, error };
};

export const createOrientee = async (orienteeData) => {
  const { data, error } = await supabase.from('orientees').insert([orienteeData]).select().single();
  return { data, error };
};

export const updateOrientee = async (id, updates) => {
  // Detect status → 'cleared' transition so we can bump the lead FTO to the bottom of the queue.
  let wasCleared = false;
  let leadFtoId = null;
  if (updates.status === 'cleared') {
    const { data: prev } = await supabase.from('orientees').select('status, lead_fto_id').eq('id', id).single();
    wasCleared = prev?.status === 'cleared';
    leadFtoId = prev?.lead_fto_id || null;
  }

  const { data, error } = await supabase.from('orientees').update(updates).eq('id', id).select().single();

  if (!error && updates.status === 'cleared' && !wasCleared && leadFtoId) {
    await moveFTOToBottom(leadFtoId);
  }

  return { data, error };
};

// ---------- FTO rotation queue ----------

export const getFTOQueue = async () => {
  // Filter on user_roles, not profiles.role. profiles.role is only the DERIVED
  // primary role, so an admin who also holds the fto role resolves to 'admin'
  // and would silently drop out of the rotation queue.
  const { data: ftoRows, error: ftosError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, queue_position, avatar_url, user_roles!inner(role)')
    .in('user_roles.role', ['lead_fto', 'fto'])
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true });
  if (ftosError) return { data: null, error: ftosError };

  // Drop the join rows; callers only need the profile fields.
  const ftos = (ftoRows || []).map(({ user_roles, ...rest }) => rest);

  const { data: orientees, error: orError } = await supabase
    .from('orientees')
    .select('id, cert_level, status, lead_fto_id, hours_completed, total_hours, hours_adjustment, temp_name, user:profiles!orientees_user_id_fkey(full_name)')
    .eq('is_archived', false)
    .neq('status', 'cleared');
  if (orError) return { data: null, error: orError };

  const byFto = {};
  (orientees || []).forEach(o => {
    if (!o.lead_fto_id) return;
    if (!byFto[o.lead_fto_id]) byFto[o.lead_fto_id] = [];
    byFto[o.lead_fto_id].push({
      id: o.id,
      name: o.user?.full_name || o.temp_name || 'Unnamed',
      cert_level: o.cert_level,
      status: o.status,
    });
  });

  const withAssignments = (ftos || []).map(f => ({ ...f, active_orientees: byFto[f.id] || [] }));
  return { data: withAssignments, error: null };
};

export const moveFTOToBottom = async (ftoId) => {
  const { data: maxRow } = await supabase
    .from('profiles')
    .select('queue_position')
    .in('role', ['lead_fto', 'fto'])
    .order('queue_position', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  const nextPos = (maxRow?.queue_position || 0) + 1;
  const { error } = await supabase.from('profiles').update({ queue_position: nextPos }).eq('id', ftoId);
  return { error };
};

export const swapFTOQueuePositions = async (idA, idB) => {
  const { data: rows, error: fetchError } = await supabase
    .from('profiles')
    .select('id, queue_position')
    .in('id', [idA, idB]);
  if (fetchError || !rows || rows.length !== 2) return { error: fetchError || new Error('Could not load FTOs to swap') };
  const a = rows.find(r => r.id === idA);
  const b = rows.find(r => r.id === idB);
  // Two-phase swap to avoid any confusion if a unique constraint is ever added later
  const temp = -1 * (Date.now() % 1000000);
  let { error: e1 } = await supabase.from('profiles').update({ queue_position: temp }).eq('id', idA);
  if (e1) return { error: e1 };
  let { error: e2 } = await supabase.from('profiles').update({ queue_position: a.queue_position }).eq('id', idB);
  if (e2) return { error: e2 };
  let { error: e3 } = await supabase.from('profiles').update({ queue_position: b.queue_position }).eq('id', idA);
  return { error: e3 };
};

export const deleteOrientee = async (id) => {
  // Soft delete - mark as archived instead of actually deleting
  // This preserves all records (evaluations, tasks, etc.) for historical reference
  const { error } = await supabase.from('orientees').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', id);
  return { error };
};

export const linkOrienteeByEmail = async (userId, email) => {
  console.log('Attempting to link orientee with email:', email, 'to user:', userId);
  
  // Call the database function that has elevated privileges
  const { data, error } = await supabase.rpc('link_orientee_by_email', {
    p_user_id: userId,
    p_email: email
  });
  
  console.log('Link function result:', data, 'Error:', error);
  
  if (error) {
    return { linked: false, reason: 'rpc_error', error };
  }
  
  return data || { linked: false, reason: 'no_response' };
};

export const getEvaluations = async () => {
  const { data, error } = await supabase.from('evaluations').select(`*, orientee:orientees(id, cert_level, temp_name, user:profiles!orientees_user_id_fkey(full_name)), evaluator:profiles!evaluations_evaluator_id_fkey(id, full_name)`).order('created_at', { ascending: false });
  return { data, error };
};

export const getEvaluationsByOrientee = async (orienteeId) => {
  const { data, error } = await supabase.from('evaluations').select(`*, evaluator:profiles!evaluations_evaluator_id_fkey(id, full_name)`).eq('orientee_id', orienteeId).order('shift_date', { ascending: false });
  return { data, error };
};

export const createEvaluation = async (evaluationData) => {
  const { data, error } = await supabase.from('evaluations').insert([evaluationData]).select().single();
  if (data && !error) {
    const { data: orientee } = await supabase.from('orientees').select('hours_completed').eq('id', evaluationData.orientee_id).single();
    if (orientee) {
      await supabase.from('orientees').update({
        hours_completed: (orientee.hours_completed || 0) + (evaluationData.hours_logged || 0),
        last_evaluation_date: evaluationData.shift_date
      }).eq('id', evaluationData.orientee_id);
    }
  }
  return { data, error };
};

export const createFTOEvaluation = async (evalData) => {
  const { data, error } = await supabase.from('fto_evaluations').insert([evalData]).select().single();
  return { data, error };
};

export const getTasks = async () => {
  const { data, error } = await supabase.from('tasks').select(`*, orientee:orientees(id, temp_name, user:profiles!orientees_user_id_fkey(full_name))`).order('created_at', { ascending: false });
  return { data, error };
};

export const getTasksByOrientee = async (orienteeId) => {
  const { data, error } = await supabase.from('tasks').select('*').eq('assigned_to', orienteeId).order('created_at', { ascending: false });
  return { data, error };
};

export const createTask = async (taskData) => {
  const { data, error } = await supabase.from('tasks').insert([taskData]).select().single();
  return { data, error };
};

export const verifyTask = async (id, verifiedBy) => {
  const { data, error } = await supabase.from('tasks').update({ status: 'completed', verified_by: verifiedBy, verified_at: new Date().toISOString() }).eq('id', id).select().single();
  return { data, error };
};

export const getTrainingMaterials = async () => {
  const { data, error } = await supabase.from('training_materials').select('*').order('created_at', { ascending: false });
  return { data, error };
};

export const createTrainingMaterial = async (materialData) => {
  const { data, error } = await supabase.from('training_materials').insert([materialData]).select().single();
  return { data, error };
};

export const updateTrainingMaterial = async (id, updates) => {
  const { data, error } = await supabase.from('training_materials').update(updates).eq('id', id).select().single();
  return { data, error };
};

export const getTrainingCompletions = async (userId) => {
  const { data, error } = await supabase
    .from('training_completions')
    .select('*')
    .eq('user_id', userId);
  return { data, error };
};

// orienteeId is optional and only set when the completion happened inside the FTO
// process. Completions for ordinary employees carry user_id alone.
export const markTrainingComplete = async (userId, materialId, orienteeId = null) => {
  const { data, error } = await supabase
    .from('training_completions')
    .insert([{
      user_id: userId,
      material_id: materialId,
      orientee_id: orienteeId,
      completed_at: new Date().toISOString(),
    }])
    .select()
    .single();
  return { data, error };
};

// Every completion across the organisation, newest first, for the admin report.
export const getCompletionReport = async () => {
  const { data, error } = await supabase
    .from('training_completions')
    .select(`
      id,
      completed_at,
      material:training_materials(id, title, type),
      user:profiles!training_completions_user_id_fkey(id, full_name, email, role, cert_level, shift)
    `)
    .not('user_id', 'is', null)
    .order('completed_at', { ascending: false });
  return { data, error };
};

export const getConversations = async (userId) => {
  const { data, error } = await supabase.from('conversation_participants').select(`conversation:conversations(id, name, is_group, created_at, participants:conversation_participants(user:profiles(id, full_name)))`).eq('user_id', userId);
  if (data) {
    return { data: data.map(d => d.conversation), error };
  }
  return { data, error };
};

export const getAllConversations = async () => {
  const { data, error } = await supabase.from('conversations').select(`id, name, is_group, created_at, participants:conversation_participants(user:profiles(id, full_name))`).order('created_at', { ascending: false });
  return { data, error };
};

export const getMessages = async (conversationId) => {
  const { data, error } = await supabase.from('messages').select(`*, sender:profiles!messages_sender_id_fkey(id, full_name)`).eq('conversation_id', conversationId).order('created_at', { ascending: true });
  return { data, error };
};

export const sendMessage = async (conversationId, senderId, content) => {
  const { data, error } = await supabase.from('messages').insert([{ conversation_id: conversationId, sender_id: senderId, content }]).select().single();
  return { data, error };
};

export const createConversation = async (name, isGroup, createdBy, participantIds) => {
  const { data: conversation, error: convError } = await supabase.from('conversations').insert([{ name, is_group: isGroup, created_by: createdBy }]).select().single();
  if (convError) return { data: null, error: convError };
  const participants = participantIds.map(userId => ({ conversation_id: conversation.id, user_id: userId }));
  const { error: partError } = await supabase.from('conversation_participants').insert(participants);
  return { data: conversation, error: partError };
};

// Mark conversation as read
export const markConversationRead = async (userId, conversationId) => {
  const { error } = await supabase.from('message_reads').upsert({
    user_id: userId,
    conversation_id: conversationId,
    last_read_at: new Date().toISOString()
  }, { onConflict: 'user_id,conversation_id' });
  return { error };
};

// Get unread message count for a user
export const getUnreadCount = async (userId) => {
  try {
    // Get all conversations for user
    const { data: convos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
    
    if (!convos || convos.length === 0) return { count: 0 };
    
    // Get last read times for all conversations
    const { data: reads } = await supabase
      .from('message_reads')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);
    
    const readMap = {};
    (reads || []).forEach(r => { readMap[r.conversation_id] = r.last_read_at; });
    
    let totalUnread = 0;
    
    // For each conversation, count messages after last read that aren't from this user
    for (const c of convos) {
      const lastRead = readMap[c.conversation_id] || '1970-01-01';
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.conversation_id)
        .neq('sender_id', userId)
        .gt('created_at', lastRead);
      totalUnread += count || 0;
    }
    
    return { count: totalUnread };
  } catch (e) {
    console.error('Error getting unread count:', e);
    return { count: 0 };
  }
};

export const getDashboardStats = async () => {
  const { data: orientees } = await supabase.from('orientees').select('status, hours_completed, total_hours, hours_adjustment, is_archived');
  const nonArchived = orientees?.filter(o => !o.is_archived) || [];
  const active = nonArchived.filter(o => o.status !== 'cleared');
  const atRisk = nonArchived.filter(o => o.status === 'at-risk' || o.status === 'extended');
  const pending = nonArchived.filter(o => o.status === 'pending-clearance');
  const avgProgress = active.length > 0 ? Math.round(active.reduce((acc, o) => {
    const totalHrs = (o.total_hours || 96) + (o.hours_adjustment || 0);
    return acc + ((o.hours_completed / totalHrs) * 100);
  }, 0) / active.length) : 0;
  return { activeOrientees: active.length, atRiskCount: atRisk.length, pendingClearance: pending.length, avgProgress };
};

// Message editing
export const updateMessage = async (messageId, content) => {
  const { data, error } = await supabase.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', messageId).select().single();
  return { data, error };
};

// Delete conversation completely (delete messages, participants, and conversation)
export const deleteConversation = async (conversationId, userId) => {
  // Delete all messages in the conversation
  await supabase.from('messages').delete().eq('conversation_id', conversationId);
  // Delete all participants
  await supabase.from('conversation_participants').delete().eq('conversation_id', conversationId);
  // Delete the conversation itself
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
  return { error };
};

// Rename conversation
export const updateConversation = async (conversationId, updates) => {
  const { data, error } = await supabase.from('conversations').update(updates).eq('id', conversationId).select().single();
  return { data, error };
};

// Get FTO evaluations (reverse feedback)
export const getFTOEvaluations = async () => {
  const { data, error } = await supabase.from('fto_evaluations').select(`*, fto:profiles!fto_evaluations_fto_id_fkey(id, full_name, email), orientee:orientees(id, temp_name, user:profiles!orientees_user_id_fkey(full_name))`).order('created_at', { ascending: false });
  return { data, error };
};

// Get FTO evaluations for a specific FTO
export const getFTOEvaluationsForFTO = async (ftoId) => {
  const { data, error } = await supabase.from('fto_evaluations').select(`*, orientee:orientees(id, temp_name, user:profiles!orientees_user_id_fkey(full_name))`).eq('fto_id', ftoId).order('created_at', { ascending: false });
  return { data, error };
};

// Profile picture upload
export const uploadProfilePicture = async (userId, file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
  if (uploadError) return { error: uploadError };
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
  const { data, error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId).select().single();
  return { data, error };
};

// Send evaluation email notification via Resend
// The Resend key lives in the send-evaluation-email edge function, never in this
// bundle. Create React App inlines env vars into the JavaScript it ships, so a
// REACT_APP_* variable would only hide the key from git -- every visitor's browser
// would still receive it. The function holds it as a server-side secret.
export const sendEvaluationEmail = async ({ to, toName, orienteeName, evaluatorName, shiftDate, rating }) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-evaluation-email', {
      body: { to, toName, orienteeName, evaluatorName, shiftDate, rating },
    });
    if (error) {
      console.error('Email send error:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
};
