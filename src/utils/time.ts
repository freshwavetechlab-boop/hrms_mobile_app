import { format } from 'date-fns';

export const formatTime = (date = new Date()) => format(date, 'hh:mm a');
export const formatDate = (date = new Date()) => format(date, 'EEEE, dd MMM yyyy');
