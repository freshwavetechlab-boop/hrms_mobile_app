import { LeaveType } from '../types/domain';

export const leaveTypes: Array<{
  type: LeaveType;
  label: string;
  description: string;
}> = [
  {
    type: 'CASUAL_LEAVE',
    label: 'Casual Leave',
    description: 'Short planned or urgent personal leave.',
  },
  {
    type: 'LOSS_OF_PAY',
    label: 'Loss of Pay',
    description: 'Unpaid leave when paid balance is unavailable.',
  },
  {
    type: 'MATERNITY',
    label: 'Maternity',
    description: 'Maternity leave benefit as per company policy.',
  },
];

export const initialLeaveBalances: Record<LeaveType, number> = {
  CASUAL_LEAVE: 0,
  LOSS_OF_PAY: 0,
  MATERNITY: 0,
};

export const getLeaveLabel = (type: LeaveType) =>
  leaveTypes.find(item => item.type === type)?.label ?? type;
