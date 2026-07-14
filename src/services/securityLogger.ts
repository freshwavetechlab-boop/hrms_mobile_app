const prefix = '[HRMS Security]';

export const securityLogger = {
  info(event: string, metadata?: Record<string, unknown>) {
    console.info(prefix, event, metadata ?? {});
  },
  warn(event: string, metadata?: Record<string, unknown>) {
    console.warn(prefix, event, metadata ?? {});
  },
};
