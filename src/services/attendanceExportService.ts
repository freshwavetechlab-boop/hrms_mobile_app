import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Base64 } from 'js-base64';
import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import {
  AttendancePeriodScope,
  AttendanceRecord,
  Employee,
} from '../types/domain';

export type AttendanceExportInput = {
  clientName: string;
  employee: Employee;
  generatedAt?: Date;
  month: string;
  records: AttendanceRecord[];
  scope?: AttendancePeriodScope;
  fromDate?: string;
  toDate?: string;
  policyName?: string;
};

type AttendanceExportRow = {
  date: string;
  payableDay: string;
  punchType: string;
  recordedAt: string;
  remarks: string;
  status: string;
  syncStatus: string;
};

const safeFormat = (timestamp: string, pattern: string) => {
  try {
    return format(parseISO(timestamp), pattern);
  } catch {
    return timestamp.slice(0, 10);
  }
};

const monthLabel = (month: string) => {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy');
  } catch {
    return month;
  }
};

const periodLabel = (input: AttendanceExportInput) => {
  if (
    input.scope === 'attendance-cycle' &&
    input.fromDate &&
    input.toDate
  ) {
    return `${safeFormat(input.fromDate, 'dd MMM yyyy')} - ${safeFormat(input.toDate, 'dd MMM yyyy')}`;
  }
  return monthLabel(input.month);
};

const toRows = (records: AttendanceRecord[]): AttendanceExportRow[] =>
  records.map(record => {
    return {
      date: safeFormat(record.timestamp, 'dd MMM yyyy'),
      status:
        record.attendanceStatus?.trim() || record.attendanceType.replace(/_/g, ' '),
      payableDay:
        record.payableValue === undefined ? '' : String(record.payableValue),
      remarks: record.remarks?.trim() || '',
      punchType: record.isPunchRecord ? record.attendanceType.replace(/_/g, ' ') : '',
      recordedAt: record.isPunchRecord ? safeFormat(record.timestamp, 'hh:mm a') : '',
      syncStatus: record.syncStatus === 'SYNCED' ? '' : record.syncStatus,
    };
  });

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const protectSpreadsheetCell = (value: unknown) => {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

const csvCell = (value: unknown) =>
  `"${protectSpreadsheetCell(value).replace(/"/g, '""')}"`;

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Employee';

export const getAttendanceExportFileName = (input: AttendanceExportInput) =>
  `Attendance_${sanitizeFilenamePart(input.employee.id || input.employee.name)}_${
    input.scope === 'attendance-cycle' && input.fromDate && input.toDate
      ? `${input.fromDate}_${input.toDate}`
      : input.month
  }`;

export const buildAttendancePdfHtml = (input: AttendanceExportInput) => {
  const rows = toRows(input.records);
  const includePunch = rows.some(row => Boolean(row.punchType || row.recordedAt));
  const includeSync = rows.some(row => Boolean(row.syncStatus));
  const generatedAt = input.generatedAt ?? new Date();
  const headerCells = [
    'Date',
    'Status',
    'Payable Day',
    'Remarks',
    ...(includePunch ? ['Punch Type', 'Recorded At'] : []),
    ...(includeSync ? ['Sync Status'] : []),
  ];
  const bodyRows = rows
    .map(row => {
      const cells = [
        row.date,
        row.status,
        row.payableDay,
        row.remarks,
        ...(includePunch ? [row.punchType, row.recordedAt] : []),
        ...(includeSync ? [row.syncStatus] : []),
      ];
      return `<tr>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 28px; }
    body { color: #172033; font-family: Arial, sans-serif; font-size: 11px; }
    h1 { color: #123C8C; font-size: 20px; margin: 0 0 6px; }
    .period { color: #5B667A; font-size: 12px; margin-bottom: 18px; }
    .meta { border: 1px solid #D0D7E2; border-radius: 6px; margin-bottom: 18px; padding: 10px; }
    .meta-row { display: flex; margin: 3px 0; }
    .meta-label { color: #5B667A; display: inline-block; font-weight: 700; width: 105px; }
    table { border-collapse: collapse; page-break-inside: auto; width: 100%; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: #E8F1FF; color: #123C8C; font-weight: 700; }
    th, td { border: 1px solid #D0D7E2; padding: 7px 6px; text-align: left; vertical-align: top; }
    .footer { color: #5B667A; font-size: 9px; margin-top: 14px; }
  </style>
</head>
<body>
  <h1>Attendance History</h1>
  <div class="period">${escapeHtml(periodLabel(input))}</div>
  <div class="meta">
    <div class="meta-row"><span class="meta-label">Workspace</span>${escapeHtml(input.clientName)}</div>
    <div class="meta-row"><span class="meta-label">Employee</span>${escapeHtml(input.employee.name)}</div>
    <div class="meta-row"><span class="meta-label">Employee ID</span>${escapeHtml(input.employee.id)}</div>
    <div class="meta-row"><span class="meta-label">Department</span>${escapeHtml(input.employee.department || '--')}</div>
    <div class="meta-row"><span class="meta-label">Designation</span>${escapeHtml(input.employee.designation || '--')}</div>
    ${input.policyName ? `<div class="meta-row"><span class="meta-label">Policy</span>${escapeHtml(input.policyName)}</div>` : ''}
  </div>
  <table>
    <thead><tr>${headerCells.map(cell => `<th>${cell}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">Generated ${escapeHtml(format(generatedAt, 'dd MMM yyyy, hh:mm a'))}</div>
</body>
</html>`;
};

export const buildAttendanceExcelCsv = (input: AttendanceExportInput) => {
  const rows = toRows(input.records);
  const includePunch = rows.some(row => Boolean(row.punchType || row.recordedAt));
  const includeSync = rows.some(row => Boolean(row.syncStatus));
  const generatedAt = input.generatedAt ?? new Date();
  const reportRows: unknown[][] = [
    ['Attendance History'],
    ['Period', periodLabel(input)],
    ['Workspace', input.clientName],
    ['Employee', input.employee.name],
    ['Employee ID', input.employee.id],
    ['Department', input.employee.department],
    ['Designation', input.employee.designation],
    ...(input.policyName ? [['Policy', input.policyName]] : []),
    ['Generated At', format(generatedAt, 'dd MMM yyyy, hh:mm a')],
    [],
    [
      'Date',
      'Status',
      'Payable Day',
      'Remarks',
      ...(includePunch ? ['Punch Type', 'Recorded At'] : []),
      ...(includeSync ? ['Sync Status'] : []),
    ],
    ...rows.map(row => [
      row.date,
      row.status,
      row.payableDay,
      row.remarks,
      ...(includePunch ? [row.punchType, row.recordedAt] : []),
      ...(includeSync ? [row.syncStatus] : []),
    ]),
  ];

  // Excel and Google Sheets both recognise the UTF-8 BOM and RFC-4180 quoting.
  return `\uFEFF${reportRows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
};

const fileUrl = (path: string) => path.startsWith('file://') ? path : `file://${path}`;

export const attendanceExportService = {
  async sharePdf(input: AttendanceExportInput) {
    const fileName = getAttendanceExportFileName(input);
    const result = await generatePDF({
      fileName,
      html: buildAttendancePdfHtml(input),
      shouldPrintBackgrounds: true,
    });
    if (!result.filePath) {
      throw new Error('ATTENDANCE_PDF_NOT_CREATED');
    }
    await Share.open({
      failOnCancel: false,
      filename: `${fileName}.pdf`,
      title: 'Share attendance PDF',
      type: 'application/pdf',
      url: fileUrl(result.filePath),
      useInternalStorage: true,
    });
  },

  async shareExcel(input: AttendanceExportInput) {
    const fileName = getAttendanceExportFileName(input);
    const csv = buildAttendanceExcelCsv(input);
    await Share.open({
      failOnCancel: false,
      filename: `${fileName}.csv`,
      title: 'Share attendance Excel file',
      type: 'text/csv',
      url: `data:text/csv;base64,${Base64.encode(csv)}`,
      useInternalStorage: true,
    });
  },
};
