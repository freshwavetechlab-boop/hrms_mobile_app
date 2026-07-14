import { open } from 'react-native-quick-sqlite';
import { AttendanceRecord } from '../types/domain';

const database = open({
  name: 'hrms_attendance.db',
  location: 'default',
});

const tableName = 'attendance_queue';

export const attendanceQueue = {
  async init() {
    await database.executeAsync(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        syncStatus TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      );`,
    );
  },
  async upsert(record: AttendanceRecord) {
    await this.init();
    await database.executeAsync(
      `INSERT OR REPLACE INTO ${tableName} (id, payload, syncStatus, timestamp, attempts) VALUES (?, ?, ?, ?, ?);`,
      [record.id, JSON.stringify(record), record.syncStatus, record.timestamp, record.attempts],
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
      records.push(JSON.parse(row.payload) as AttendanceRecord);
    }
    return records;
  },
  async getAll() {
    await this.init();
    const result = await database.executeAsync(
      `SELECT payload FROM ${tableName} ORDER BY timestamp DESC;`,
    );
    const rows = result.rows?._array ?? [];
    return (rows as { payload: string }[]).map(row => JSON.parse(row.payload) as AttendanceRecord);
  },
};
