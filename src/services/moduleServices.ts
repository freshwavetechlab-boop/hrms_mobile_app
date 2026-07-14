import { apiClient } from './apiClient';

const placeholderGet = async <T>(path: string, fallback: T) => {
  try {
    const response = await apiClient.get<T>(path);
    return response.data;
  } catch {
    return fallback;
  }
};

const placeholderPost = async <T>(path: string, payload: unknown, fallback: T) => {
  try {
    const response = await apiClient.post<T>(path, payload);
    return response.data;
  } catch {
    return fallback;
  }
};

export const leaveService = {
  getBalance: () => placeholderGet('/api/ess/leave/balances', { available: 12, used: 4 }),
};

export const notificationsService = {
  getLatest: () => placeholderGet('/api/notifications', []),
};

export const documentsService = {
  getDocuments: () => placeholderGet('/api/documents', []),
};

export const profileService = {
  getProfile: () => placeholderGet('/api/ess/profile', undefined),
};

export const payslipService = {
  getPayslips: () => placeholderGet('/api/ess/pay/payslips', []),
};

export const requestsService = {
  getRequests: () => placeholderGet('/api/ess/leave/requests', []),
};

export const taxService = {
  getTaxSummary: () => placeholderGet('/api/ess/tax', undefined),
  saveRegime: (payload: unknown) => placeholderPost('/api/ess/tax/regime', payload, payload),
  saveDeclarations: (payload: unknown) =>
    placeholderPost('/api/ess/tax/declarations', payload, payload),
};

export const learningService = {
  getCourses: () => placeholderGet('/api/learning/courses', []),
};

export const performanceService = {
  getGoals: () => placeholderGet('/api/performance/goals', []),
};
