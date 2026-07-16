import { open } from 'react-native-quick-sqlite';
import { AttendanceRecord } from '../types/domain';

const database = open({
  name: 'hrms_attendance.db',
  location: 'default',
});

const tableName = 'attendance_queue';

type LegacyAttendanceRecord = AttendanceRecord & {
  batteryPercentage?: unknown;
  capturedImageRef?: unknown;
  facialVerification?: { provider?: string };
};

const sanitizeAttendanceRecord = (record: LegacyAttendanceRecord): AttendanceRecord => {
  const safeRecord = { ...record };
  const facialVerification = safeRecord.facialVerification;
  delete safeRecord.batteryPercentage;
  delete safeRecord.capturedImageRef;
  delete safeRecord.facialVerification;
  return {
    ...safeRecord,
    cameraCaptureConfirmed: Boolean(safeRecord.cameraCaptureConfirmed),
    biometricConfirmed: Boolean(safeRecord.biometricConfirmed),
    isPunchRecord:
      typeof safeRecord.isPunchRecord === 'boolean'
        ? safeRecord.isPunchRecord
        : Boolean(facialVerification && facialVerification.provider !== 'not-applicable'),
  };
};

const parseAttendanceRecord = (payload: string) =>
  sanitizeAttendanceRecord(JSON.parse(payload) as LegacyAttendanceRecord);

let initialization: Promise<void> | undefined;

const initialize = async () => {
  await database.executeAsync(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      syncStatus TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );`,
  );
  const result = await database.executeAsync(`SELECT id, payload FROM ${tableName};`);
  const rows = result.rows?._array ?? [];
  for (const row of rows as { id: string; payload: string }[]) {
    try {
      const sanitizedPayload = JSON.stringify(parseAttendanceRecord(row.payload));
      if (sanitizedPayload !== row.payload) {
        await database.executeAsync(
          `UPDATE ${tableName} SET payload = ? WHERE id = ?;`,
          [sanitizedPayload, row.id],
        );
      }
    } catch {
      // Leave malformed legacy rows untouched so queue initialization remains available.
    }
  }
};

export const attendanceQueue = {
  async init() {
    initialization ??= initialize();
    await initialization;
  },
  async upsert(record: AttendanceRecord) {
    await this.init();
    const sanitizedRecord = sanitizeAttendanceRecord(record as LegacyAttendanceRecord);
    await database.executeAsync(
      `INSERT OR REPLACE INTO ${tableName} (id, payload, syncStatus, timestamp, attempts) VALUES (?, ?, ?, ?, ?);`,
      [
        sanitizedRecord.id,
        JSON.stringify(sanitizedRecord),
        sanitizedRecord.syncStatus,
        sanitizedRecord.timestamp,
        sanitizedRecord.attempts,
      ],
    );
  },
  async getPending() {
    await this.init();
    const result = await database.executeAsync(
      `SELECT payload FROM ${tableName} WHERE syncStatus = ? ORDER BY timestamp ASC;`,
      ['PENDING'],
    );
    const records: AttendanceRecord[] = [];
    const rows = result.rows?._array ?? [];
    for (const row of rows as { payload: string }[]) {
      records.push(parseAttendanceRecord(row.payload));
    }
    return records;
  },
  async getAll() {
    await this.init();
    const result = await database.executeAsync(
      `SELECT payload FROM ${tableName} ORDER BY timestamp DESC;`,
    );
    const rows = result.rows?._array ?? [];
    return (rows as { payload: string }[]).map(row => parseAttendanceRecord(row.payload));
  },
};
