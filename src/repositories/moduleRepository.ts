import {
  documentsService,
  learningService,
  leaveService,
  notificationsService,
  payslipService,
  performanceService,
  profileService,
  requestsService,
  taxService,
} from '../services/moduleServices';

export const moduleRepository = {
  leave: leaveService,
  notifications: notificationsService,
  documents: documentsService,
  profile: profileService,
  payslips: payslipService,
  requests: requestsService,
  tax: taxService,
  learning: learningService,
  performance: performanceService,
};
