import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';

export const formatTime = (date = new Date()) => format(date, 'hh:mm a');
export const formatDate = (date = new Date()) => format(date, 'EEEE, dd MMM yyyy');
export const formatIsoDateKey = (timestamp: string) =>
  format(parseISO(timestamp), 'yyyy-MM-dd');
export const formatIsoMonthKey = (timestamp: string) => format(parseISO(timestamp), 'yyyy-MM');
