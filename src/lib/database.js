import { supabase } from './supabase';

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return { data, error };
};

export const getAllProfiles = async () => {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  return { data, error };
};

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
  return { data, error };
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
  const { data, error } = await supabase.from('orientees').update(updates).eq('id', id).select().single();
  return { data, error };
};

export const deleteOrientee = async (id) => {
  // Delete related records first (evaluations, tasks, training completions)
  await supabase.from('evaluations').delete().eq('orientee_id', id);
  await supabase.from('tasks').delete().eq('assigned_to', id);
  await supabase.from('training_completions').delete().eq('orientee_id', id);
  await supabase.from('fto_evaluations').delete().eq('orientee_id', id);
  // Then delete the orientee
  const { error } = await supabase.from('orientees').delete().eq('id', id);
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

export const getTrainingCompletions = async (orienteeId) => {
  const { data, error } = await supabase.from('training_completions').select('*').eq('orientee_id', orienteeId);
  return { data, error };
};

export const markTrainingComplete = async (orienteeId, materialId) => {
  const { data, error } = await supabase.from('training_completions').insert([{ orientee_id: orienteeId, material_id: materialId, completed_at: new Date().toISOString() }]).select().single();
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
  const { data: orientees } = await supabase.from('orientees').select('status, hours_completed, total_hours, hours_adjustment');
  const active = orientees?.filter(o => o.status !== 'cleared') || [];
  const atRisk = orientees?.filter(o => o.status === 'at-risk' || o.status === 'extended') || [];
  const pending = orientees?.filter(o => o.status === 'pending-clearance') || [];
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
export const sendEvaluationEmail = async ({ to, toName, orienteeName, evaluatorName, shiftDate, rating }) => {
  const RESEND_API_KEY = 're_YXxb6Ki7_CDA68WN4jKwa8GrZ5oAENFff';
  
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const formattedDate = new Date(shiftDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
    .rating { font-size: 24px; color: #eab308; }
    .detail { margin: 10px 0; padding: 12px; background: white; border-radius: 8px; }
    .label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .value { font-size: 16px; font-weight: 600; color: #1e293b; }
    .footer { text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">New Evaluation Submitted</h1>
      <p style="margin:10px 0 0 0; opacity:0.9;">Adams Regional EMS Training</p>
    </div>
    <div class="content">
      <p>Hi ${toName},</p>
      <p>A new evaluation has been submitted for your orientee:</p>
      
      <div class="detail">
        <div class="label">Orientee</div>
        <div class="value">${orienteeName}</div>
      </div>
      
      <div class="detail">
        <div class="label">Evaluated By</div>
        <div class="value">${evaluatorName}</div>
      </div>
      
      <div class="detail">
        <div class="label">Shift Date</div>
        <div class="value">${formattedDate}</div>
      </div>
      
      <div class="detail">
        <div class="label">Overall Rating</div>
        <div class="value rating">${stars}</div>
      </div>
      
      <p style="margin-top:20px;">Log in to the AREMS dashboard to view the full evaluation details.</p>
    </div>
    <div class="footer">
      <p>Adams Regional EMS - Orientee Tracking System</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'AREMS Notifications <noreply@arems.net>',
        to: [to],
        subject: `New Evaluation for ${orienteeName}`,
        html: html,
      }),
    });
    
    const data = await response.json();
    console.log('Email sent:', data);
    return { success: response.ok, data };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
};
