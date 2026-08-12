// Excel and Sheets execute a cell that starts with any of these.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\n\r]/;

export const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_PREFIX.test(s)) s = "'" + s;
  if (NEEDS_QUOTING.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

// columns: [{ label, value: row => cell }]
export const toCSV = (rows, columns) => {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const body = (rows || []).map(r => columns.map(c => escapeCell(c.value(r))).join(','));
  return [header, ...body].join('\r\n');
};

export const downloadCSV = (filename, csv) => {
  // The BOM makes Excel read the file as UTF-8 rather than the local codepage.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
