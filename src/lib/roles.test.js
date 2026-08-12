import { hasRole, hasAnyRole, primaryRole, ROLE_PRECEDENCE, ROLE_LABELS, CERT_LEVELS } from './roles';

describe('hasRole', () => {
  it('reads the roles array when present', () => {
    expect(hasRole({ roles: ['fto', 'employee'] }, 'fto')).toBe(true);
    expect(hasRole({ roles: ['fto', 'employee'] }, 'admin')).toBe(false);
  });

  it('falls back to the legacy scalar role', () => {
    expect(hasRole({ role: 'admin' }, 'admin')).toBe(true);
    expect(hasRole({ role: 'admin' }, 'fto')).toBe(false);
  });

  it('prefers the roles array over the scalar when both exist', () => {
    expect(hasRole({ role: 'employee', roles: ['admin'] }, 'admin')).toBe(true);
  });

  it('treats an empty roles array as authoritative, not missing', () => {
    expect(hasRole({ role: 'admin', roles: [] }, 'admin')).toBe(false);
  });

  it('is safe on null and undefined', () => {
    expect(hasRole(null, 'admin')).toBe(false);
    expect(hasRole(undefined, 'admin')).toBe(false);
    expect(hasRole({}, 'admin')).toBe(false);
  });
});

describe('hasAnyRole', () => {
  it('is true when any role matches', () => {
    expect(hasAnyRole({ roles: ['employee'] }, ['admin', 'employee'])).toBe(true);
  });

  it('is false when none match', () => {
    expect(hasAnyRole({ roles: ['employee'] }, ['admin', 'fto'])).toBe(false);
  });

  it('is false for an empty candidate list', () => {
    expect(hasAnyRole({ roles: ['admin'] }, [])).toBe(false);
  });
});

describe('primaryRole', () => {
  it('returns the highest-precedence role held', () => {
    expect(primaryRole(['employee', 'admin', 'fto'])).toBe('admin');
    expect(primaryRole(['employee', 'fto'])).toBe('fto');
    expect(primaryRole(['employee'])).toBe('employee');
  });

  it('ranks lead_fto above fto', () => {
    expect(primaryRole(['fto', 'lead_fto'])).toBe('lead_fto');
  });

  it('returns null for empty or missing input', () => {
    expect(primaryRole([])).toBeNull();
    expect(primaryRole(null)).toBeNull();
    expect(primaryRole(undefined)).toBeNull();
  });

  it('ignores unknown roles', () => {
    expect(primaryRole(['wizard'])).toBeNull();
    expect(primaryRole(['wizard', 'fto'])).toBe('fto');
  });
});

describe('constants', () => {
  it('orders precedence from most to least privileged', () => {
    expect(ROLE_PRECEDENCE).toEqual(['admin', 'lead_fto', 'fto', 'orientee', 'employee']);
  });

  it('labels every role in the precedence list', () => {
    ROLE_PRECEDENCE.forEach(r => expect(typeof ROLE_LABELS[r]).toBe('string'));
  });

  it('lists the three EMS certification levels in ladder order', () => {
    expect(CERT_LEVELS).toEqual(['EMT', 'AEMT', 'Paramedic']);
  });
});
