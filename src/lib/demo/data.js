// Fictional seed data for demo mode (REACT_APP_DEMO=true). Nothing here is a real
// person or record. The store lives in memory and resets on reload.

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const stamp = (offsetDays, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const person = (id, full_name, roles, cert_level, shift, queue_position = null) => ({
  id, full_name, email: full_name.toLowerCase().replace(/\s+/g, '.') + '@example.org',
  phone: '555-01' + String(id.length * 7 + full_name.length).padStart(2, '0'),
  roles, role: roles[0], cert_level, shift, queue_position, avatar_url: null,
});

export const seed = () => {
  const profiles = [
    person('u-admin', 'Dana Whitlock', ['admin', 'fto'], 'Paramedic', 'A Shift', 3),
    person('u-lead', 'Marcus Reyes', ['lead_fto'], 'Paramedic', 'B Shift', 1),
    person('u-fto1', 'Priya Nair', ['fto'], 'Paramedic', 'C Shift', 2),
    person('u-fto2', 'Tom Becker', ['fto'], 'AEMT', 'A Shift', 4),
    person('u-ori1', 'Jordan Ellis', ['orientee'], 'EMT', 'B Shift'),
    person('u-ori2', 'Sam Okafor', ['orientee'], 'Paramedic', 'C Shift'),
    person('u-emp1', 'Riley Chen', ['employee'], 'EMT', 'A Shift'),
    person('u-emp2', 'Alex Morgan', ['employee'], 'AEMT', 'Part-Time'),
  ];

  const orientee = (id, o) => ({
    id, user_id: null, temp_name: null, temp_email: null, temp_phone: null,
    cert_level: 'EMT', shift: 'A Shift', station: '54-1', total_hours: 96, hours_adjustment: 0,
    adjustment_reason: null, hours_completed: 0, status: 'on-track', is_archived: false,
    orientation_book_url: null, tentative_clear_date: null, last_evaluation_date: null,
    created_at: stamp(-40), ...o,
  });

  const orientees = [
    orientee('o-1', { user_id: 'u-ori1', lead_fto_id: 'u-lead', cert_level: 'EMT', shift: 'B Shift', station: '54-2', hours_completed: 52, start_date: day(-24), tentative_clear_date: day(18), last_evaluation_date: day(-2), orientation_book_url: 'https://example.org/orientation-book' }),
    orientee('o-2', { user_id: 'u-ori2', lead_fto_id: 'u-fto1', cert_level: 'Paramedic', shift: 'C Shift', hours_completed: 78, status: 'at-risk', start_date: day(-45), tentative_clear_date: day(6), last_evaluation_date: day(-9) }),
    orientee('o-3', { temp_name: 'Casey Lambert', temp_email: 'casey.lambert@example.org', lead_fto_id: 'u-fto2', cert_level: 'AEMT', hours_completed: 12, start_date: day(-5), tentative_clear_date: day(40), last_evaluation_date: day(-1) }),
    orientee('o-4', { temp_name: 'Morgan Diaz', temp_email: 'morgan.diaz@example.org', lead_fto_id: 'u-lead', cert_level: 'EMT', station: '54-3', hours_completed: 92, status: 'pending-clearance', start_date: day(-60), tentative_clear_date: day(2), last_evaluation_date: day(-3) }),
    orientee('o-5', { temp_name: 'Taylor Brooks', temp_email: 'taylor.brooks@example.org', lead_fto_id: 'u-fto1', cert_level: 'Paramedic', shift: 'B Shift', hours_completed: 40, hours_adjustment: 24, adjustment_reason: 'Additional ALS ride time requested by lead FTO', status: 'extended', start_date: day(-52), last_evaluation_date: day(-12) }),
    orientee('o-6', { temp_name: 'Jamie Fox', temp_email: 'jamie.fox@example.org', lead_fto_id: 'u-fto2', cert_level: 'EMT', hours_completed: 96, status: 'cleared', start_date: day(-120), last_evaluation_date: day(-70) }),
    orientee('o-7', { temp_name: 'Pat Quinn', temp_email: 'pat.quinn@example.org', lead_fto_id: 'u-lead', cert_level: 'AEMT', hours_completed: 30, status: 'on-track', is_archived: true, start_date: day(-200) }),
  ];

  const ev = (id, orientee_id, evaluator_id, offset, rating, hours, phase, extra = {}) => ({
    id, orientee_id, evaluator_id, shift_date: day(offset), shift_type: offset % 2 ? 'Night' : 'Day', station: '54-1',
    hours_logged: hours, overall_rating: rating, phase, daily_tasks: ['Truck Check', 'Patient Assessment', 'Documentation'],
    strengths: 'Calm on scene and communicates clearly with the patient and family.',
    improvements: 'Narrative documentation needs more detail on reassessment times.',
    created_at: stamp(offset, 19), ...extra,
  });

  const evaluations = [
    ev('e-1', 'o-1', 'u-lead', -2, 4, 12, 2),
    ev('e-2', 'o-1', 'u-fto1', -6, 4, 12, 2, { daily_tasks: ['Truck Check', 'Radio Comms', 'Protocols', 'Lifting'] }),
    ev('e-3', 'o-1', 'u-lead', -10, 3, 12, 2, { improvements: 'Slow to set up the monitor. Practice 12-lead placement.' }),
    ev('e-4', 'o-1', 'u-emp1', -15, 4, 8, 1),
    ev('e-5', 'o-1', 'u-lead', -20, 3, 8, 1),
    ev('e-6', 'o-2', 'u-fto1', -9, 2, 12, 3, { strengths: 'Strong clinical knowledge.', improvements: 'Scene leadership: hesitated to delegate on a multi-patient call. Needs to take command earlier.' }),
    ev('e-7', 'o-2', 'u-fto1', -14, 3, 12, 3),
    ev('e-8', 'o-2', 'u-admin', -21, 3, 12, 2),
    ev('e-9', 'o-3', 'u-fto2', -1, 4, 12, 1, { strengths: 'Great first shift. Asked good questions during truck check.', improvements: '' }),
    ev('e-10', 'o-4', 'u-lead', -3, 5, 12, 4, { strengths: 'Ran every call independently. Ready for clearance.', improvements: '' }),
    ev('e-11', 'o-4', 'u-lead', -8, 5, 12, 3),
    ev('e-12', 'o-5', 'u-fto1', -12, 2, 8, 2, { improvements: 'Medication math under pressure. Extended ride time added.' }),
    ev('e-13', 'o-6', 'u-fto2', -70, 5, 12, 4),
  ];

  const task = (id, assigned_to, title, description, status, dueOffset) => ({
    id, assigned_to, assigned_by: 'u-lead', title, description, status,
    due_date: dueOffset === null ? null : day(dueOffset), created_at: stamp(-14),
    verified_by: status === 'completed' ? 'u-lead' : null, verified_at: status === 'completed' ? stamp(-3) : null,
  });

  const tasks = [
    task('t-1', 'o-1', 'Map book: district 54 first-due streets', 'Verbal quiz with FTO', 'completed', -8),
    task('t-2', 'o-1', 'Stretcher and stair chair sign-off', 'Demonstrate loading with a weighted manikin', 'pending', 3),
    task('t-3', 'o-1', 'Narcotics log walkthrough', '', 'pending', -2),
    task('t-4', 'o-2', 'RSI checklist review', 'Walk through the checklist with medical director notes', 'pending', 1),
    task('t-5', 'o-2', 'Lead a simulated MCI triage', '', 'pending', -4),
    task('t-6', 'o-3', 'Station tour and locker assignment', '', 'completed', -4),
    task('t-7', 'o-3', 'Radio channel plan', 'Know dispatch, tac and hospital channels', 'pending', 6),
    task('t-8', 'o-4', 'Final clearance interview', 'Schedule with the training officer', 'pending', 2),
    task('t-9', 'o-5', 'Drug dose card drill', 'Ten scenarios without a reference', 'pending', null),
  ];

  const materials = [
    { id: 'm-1', title: 'Stroke alert protocol update', description: 'Regional changes to LVO screening and hospital destination.', type: 'video', url: 'https://example.org/training/stroke-alert', created_at: stamp(-3) },
    { id: 'm-2', title: 'Ambulance operations & safe backing', description: 'Annual driver refresher. Spotter rules and intersection policy.', type: 'powerpoint', url: 'https://example.org/training/evoc', created_at: stamp(-10) },
    { id: 'm-3', title: 'Bloodborne pathogens — annual', description: 'Exposure control plan and reporting steps.', type: 'document', url: 'https://example.org/training/bbp', created_at: stamp(-20) },
    { id: 'm-4', title: 'ePCR narrative standards', description: 'What QA looks for in a complete chart.', type: 'document', url: 'https://example.org/training/epcr', created_at: stamp(-28) },
    { id: 'm-5', title: 'Pediatric dosing reference', description: '', type: 'link', url: 'https://example.org/training/peds', created_at: stamp(-35) },
    { id: 'm-6', title: 'Stretcher and power-load in-service', description: 'Manufacturer walkthrough of the power-load system.', type: 'video', url: 'https://example.org/training/stretcher', created_at: stamp(-50) },
  ];

  const completion = (id, user_id, material_id, offset, orientee_id = null) => ({ id, user_id, material_id, orientee_id, completed_at: stamp(offset, 14) });
  const completions = [
    completion('c-1', 'u-admin', 'm-3', -15), completion('c-2', 'u-admin', 'm-4', -12), completion('c-3', 'u-admin', 'm-2', -6),
    completion('c-4', 'u-lead', 'm-3', -18), completion('c-5', 'u-lead', 'm-1', -2),
    completion('c-6', 'u-fto1', 'm-3', -16), completion('c-7', 'u-fto1', 'm-4', -9),
    completion('c-8', 'u-ori1', 'm-3', -19, 'o-1'), completion('c-9', 'u-ori1', 'm-4', -11, 'o-1'), completion('c-10', 'u-ori1', 'm-6', -5, 'o-1'),
    completion('c-11', 'u-ori2', 'm-3', -30, 'o-2'),
    completion('c-12', 'u-emp1', 'm-3', -14), completion('c-13', 'u-emp1', 'm-2', -4),
    completion('c-14', 'u-emp2', 'm-6', -40),
  ];

  const ftoEval = (id, fto_id, orientee_id, offset, r) => ({
    id, fto_id, orientee_id, shift_date: day(offset), overall_rating: r[0], communication_rating: r[1], teaching_rating: r[2], support_rating: r[3],
    feedback: 'Explains the why behind each step and gives feedback right after the call.', created_at: stamp(offset, 20),
  });
  const ftoEvaluations = [
    ftoEval('f-1', 'u-lead', 'o-1', -2, [5, 5, 4, 5]), ftoEval('f-2', 'u-lead', 'o-4', -8, [5, 4, 5, 5]),
    ftoEval('f-3', 'u-fto1', 'o-2', -9, [4, 3, 4, 4]), ftoEval('f-4', 'u-fto1', 'o-1', -6, [4, 4, 5, 4]),
    ftoEval('f-5', 'u-fto2', 'o-3', -1, [5, 5, 5, 5]), ftoEval('f-6', 'u-admin', 'o-2', -21, [4, 4, 3, 4]),
  ];

  const conversations = [
    { id: 'cv-1', name: null, is_group: false, created_at: stamp(-9), participantIds: ['u-admin', 'u-lead'] },
    { id: 'cv-2', name: 'B Shift FTOs', is_group: true, created_at: stamp(-20), participantIds: ['u-admin', 'u-lead', 'u-fto1', 'u-fto2'] },
    { id: 'cv-3', name: null, is_group: false, created_at: stamp(-6), participantIds: ['u-lead', 'u-ori1'] },
    { id: 'cv-4', name: null, is_group: false, created_at: stamp(-4), participantIds: ['u-fto1', 'u-ori2'] },
  ];
  const msg = (id, conversation_id, sender_id, offset, hour, minute, content) => ({ id, conversation_id, sender_id, content, created_at: stamp(offset, hour, minute), edited_at: null });
  const messages = [
    msg('g-1', 'cv-1', 'u-lead', -1, 16, 5, 'Morgan is ready. I would like to schedule the clearance interview this week.'),
    msg('g-2', 'cv-1', 'u-admin', -1, 16, 40, 'Agreed. Thursday at 0900 works on my end.'),
    msg('g-3', 'cv-1', 'u-lead', 0, 7, 50, 'Booked. I will bring the completed task book.'),
    msg('g-4', 'cv-2', 'u-fto1', -2, 12, 10, 'Reminder: evaluations are due before end of shift, not the next morning.'),
    msg('g-5', 'cv-2', 'u-fto2', -2, 12, 30, 'Copy. Casey starts with me on A shift.'),
    msg('g-6', 'cv-2', 'u-admin', -1, 8, 15, 'New stroke alert video is in the training library. Please complete it by Friday.'),
    msg('g-7', 'cv-3', 'u-lead', -1, 18, 0, 'Nice work on the cardiac arrest today. Review the narcotics log before Thursday.'),
    msg('g-8', 'cv-3', 'u-ori1', -1, 18, 22, 'Thanks. Will do — is the stair chair sign-off still Friday?'),
    msg('g-9', 'cv-3', 'u-lead', 0, 8, 5, 'Yes, Friday at shift start.'),
    msg('g-10', 'cv-4', 'u-fto1', -3, 15, 0, 'Let us run the MCI triage sim again next shift.'),
  ];
  const reads = [{ user_id: 'u-admin', conversation_id: 'cv-2', last_read_at: stamp(-2, 13) }];

  return { profiles, orientees, evaluations, tasks, materials, completions, ftoEvaluations, conversations, messages, reads };
};

export const DEMO_LOGINS = [
  { id: 'u-admin', label: 'Admin', hint: 'Sees everything' },
  { id: 'u-lead', label: 'Lead FTO', hint: 'Runs the field programme' },
  { id: 'u-ori1', label: 'Orientee', hint: 'Own progress only' },
  { id: 'u-emp1', label: 'Employee', hint: 'Training library' },
];
