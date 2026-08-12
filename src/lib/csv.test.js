import { escapeCell, toCSV } from './csv';

describe('escapeCell', () => {
  it('passes plain values through', () => {
    expect(escapeCell('Smith')).toBe('Smith');
    expect(escapeCell(42)).toBe('42');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });

  it('quotes values containing a comma', () => {
    expect(escapeCell('Smith, John')).toBe('"Smith, John"');
  });

  it('doubles embedded quotes and wraps', () => {
    expect(escapeCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('neutralizes spreadsheet formula injection', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1");
    expect(escapeCell('+1')).toBe("'+1");
    expect(escapeCell('-1')).toBe("'-1");
    expect(escapeCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes a neutralized value that also contains a comma', () => {
    expect(escapeCell('=A1,B1')).toBe('"\'=A1,B1"');
  });

  it('leaves a hyphen mid-string alone', () => {
    expect(escapeCell('Anne-Marie')).toBe('Anne-Marie');
  });
});

describe('toCSV', () => {
  const columns = [
    { label: 'Name', value: r => r.name },
    { label: 'Hours', value: r => r.hours },
  ];

  it('writes a header row followed by data rows', () => {
    const csv = toCSV([{ name: 'Ann', hours: 8 }, { name: 'Bo', hours: 12 }], columns);
    expect(csv).toBe('Name,Hours\r\nAnn,8\r\nBo,12');
  });

  it('writes just the header when there are no rows', () => {
    expect(toCSV([], columns)).toBe('Name,Hours');
  });

  it('escapes values inside rows', () => {
    const csv = toCSV([{ name: 'Smith, John', hours: 8 }], columns);
    expect(csv).toBe('Name,Hours\r\n"Smith, John",8');
  });
});
