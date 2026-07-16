jest.mock('react-native-html-to-pdf', () => ({
  generatePDF: jest.fn(),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: jest.fn(),
  },
}));

import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import {
  attendanceExportService,
  buildAttendanceExcelCsv,
  buildAttendancePdfHtml,
  getAttendanceExportFileName,
  AttendanceExportInput,
} from '../src/services/attendanceExportService';
import { AttendanceRecord } from '../src/types/domain';

const record = (overrides: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  accuracyMeters: 5,
  appVersion: '1.0.0',
  attempts: 0,
  attendanceStatus: 'Present',
  attendanceType: 'CHECK_IN',
  cameraCaptureConfirmed: false,
  biometricConfirmed: false,
  clientCode: 'GAD',
  deviceId: 'secret-device',
  employeeId: 'REC135',
  id: 'daily-2026-07-14',
  isPunchRecord: false,
  latitude: 28.61,
  longitude: 77.2,
  networkType: 'wifi',
  payableValue: 1,
  remarks: 'On time',
  syncStatus: 'SYNCED',
  timestamp: '2026-07-14T00:00:00',
  ...overrides,
});

const input = (records: AttendanceRecord[] = [record()]): AttendanceExportInput => ({
  clientName: 'GA Digital & Co',
  employee: {
    department: 'Operations',
    designation: 'Employee',
    email: 'employee@example.com',
    id: 'REC/135',
    manager: 'Manager',
    name: 'Surjeet Kumar',
  },
  generatedAt: new Date('2026-07-14T10:30:00'),
  month: '2026-07',
  records,
});

describe('attendance export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a deterministic safe filename', () => {
    expect(getAttendanceExportFileName(input())).toBe('Attendance_REC_135_2026-07');
  });

  it('uses the resolved attendance cycle range in export labels and filenames', () => {
    const cycleInput: AttendanceExportInput = {
      ...input(),
      scope: 'attendance-cycle',
      fromDate: '2026-06-26',
      toDate: '2026-07-25',
      policyName: 'REC attendance policy',
    };

    expect(getAttendanceExportFileName(cycleInput)).toBe(
      'Attendance_REC_135_2026-06-26_2026-07-25',
    );
    expect(buildAttendancePdfHtml(cycleInput)).toContain(
      '26 Jun 2026 - 25 Jul 2026',
    );
    expect(buildAttendancePdfHtml(cycleInput)).toContain('REC attendance policy');
    expect(buildAttendanceExcelCsv(cycleInput)).toContain(
      '"Period","26 Jun 2026 - 25 Jul 2026"',
    );
  });

  it('escapes PDF content and excludes private attendance audit fields', () => {
    const html = buildAttendancePdfHtml(
      input([record({ remarks: '<script>alert("x")</script>' })]),
    );

    expect(html).toContain('GA Digital &amp; Co');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain('/private/selfie.jpg');
    expect(html).not.toContain('secret-device');
    expect(html).not.toContain('28.61');
  });

  it('quotes CSV data and neutralises spreadsheet formulas', () => {
    const csv = buildAttendanceExcelCsv(
      input([record({ remarks: '=HYPERLINK("bad","click")' })]),
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"",""click"")"');
    expect(csv).not.toContain('secret-device');
  });

  it('generates and shares a cached PDF file', async () => {
    (generatePDF as jest.Mock).mockResolvedValue({ filePath: '/cache/attendance.pdf' });

    await attendanceExportService.sharePdf(input());

    expect(generatePDF).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'Attendance_REC_135_2026-07',
    }));
    expect(Share.open).toHaveBeenCalledWith(expect.objectContaining({
      failOnCancel: false,
      filename: 'Attendance_REC_135_2026-07.pdf',
      type: 'application/pdf',
      url: 'file:///cache/attendance.pdf',
      useInternalStorage: true,
    }));
  });

  it('shares the Excel-compatible CSV from Android internal storage', async () => {
    await attendanceExportService.shareExcel(input());

    expect(Share.open).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'Attendance_REC_135_2026-07.csv',
      type: 'text/csv',
      url: expect.stringMatching(/^data:text\/csv;base64,/),
      useInternalStorage: true,
    }));
  });
});
