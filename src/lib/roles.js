// Roles a user can hold. Ordered most-privileged first; primaryRole() depends on this order.
export const ROLE_PRECEDENCE = ['admin', 'lead_fto', 'fto', 'orientee', 'employee'];

export const ROLE_LABELS = {
  admin: 'Admin',
  lead_fto: 'Lead FTO',
  fto: 'FTO',
  orientee: 'Orientee',
  employee: 'Employee',
};

// EMS certifications ladder, so a person holds exactly one of these.
export const CERT_LEVELS = ['EMT', 'AEMT', 'Paramedic'];

// Accepts a profile with either a `roles` array (current) or a scalar `role` (legacy).
// The array wins when present, including when it is empty — an empty array means
// "this user genuinely holds no roles", not "the array is missing".
export const hasRole = (profile, role) => {
  if (!profile) return false;
  if (Array.isArray(profile.roles)) return profile.roles.includes(role);
  return profile.role === role;
};

export const hasAnyRole = (profile, roles) => (roles || []).some(r => hasRole(profile, r));

// The highest-privilege role held, used for display and for legacy scalar comparisons.
export const primaryRole = (roles) => {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  return ROLE_PRECEDENCE.find(r => roles.includes(r)) || null;
};
