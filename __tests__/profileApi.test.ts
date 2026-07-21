import { apiClient } from '../src/services/apiClient';
import {
  employeeFromSelfProfile,
  essApiService,
} from '../src/services/essApiService';
import { sessionStorage } from '../src/services/sessionStorage';
import { saveSelfProfile } from '../src/store/slices/authSlice';
import {
  ClientProfile,
  EmployeeSelfProfile,
  SaveEmployeeSelfProfileRequest,
  Session,
} from '../src/types/domain';

const client: ClientProfile = {
  code: 'GAD',
  name: 'GA Digital',
  supportEmail: '',
  apiBaseUrl: 'https://hrms.example.test',
  validFromUtc: '2026-01-01T00:00:00Z',
  validUntilUtc: '2027-01-01T00:00:00Z',
  isActive: true,
  validatedAt: '2026-07-14T00:00:00Z',
  branding: {
    primaryColor: '#062B6F',
    accentColor: '#13BFA6',
    logoInitials: 'GAD',
  },
};

const profile: EmployeeSelfProfile = {
  clientId: 10,
  employeeCode: 'TAT103',
  firstName: 'Aparna',
  lastName: 'Tiwari',
  workEmail: 'aparna@example.test',
  dateOfBirth: '',
  mobile: '9876543210',
  panNumber: 'ABCDE1234F',
  aadhaarNumber: '',
  address: '',
  correspondenceAddress: '',
  permanentAddress: '',
  city: '',
  district: '',
  state: '',
  bankName: '',
  bankAccountNo: '',
  ifscCode: '',
  paymentMode: 'Bank Transfer',
  department: 'IT',
  designation: 'Engineer',
  dateOfJoining: '2026-07-01',
  workLocation: 'Bhopal',
  attendanceOffice: 'Bhopal Office',
  reportingManager: 'TAT Manager',
  canEdit: true,
  travelExpenseEnabled: false,
};

const request: SaveEmployeeSelfProfileRequest = {
  firstName: profile.firstName,
  lastName: profile.lastName,
  workEmail: profile.workEmail,
  dateOfBirth: profile.dateOfBirth,
  mobile: profile.mobile,
  panNumber: profile.panNumber,
  aadhaarNumber: profile.aadhaarNumber,
  address: profile.address,
  correspondenceAddress: profile.correspondenceAddress,
  permanentAddress: profile.permanentAddress,
  city: profile.city,
  district: profile.district,
  state: profile.state,
  bankName: profile.bankName,
  bankAccountNo: profile.bankAccountNo,
  ifscCode: profile.ifscCode,
  paymentMode: profile.paymentMode,
};

const session: Session = {
  accessToken: 'secure-token',
  hrmsClientId: 10,
  hrmsEmployeeId: 715,
  profileValidatedAt: Date.now(),
  client,
  employee: {
    id: 'TAT103',
    name: 'Old Name',
    email: 'old@example.test',
    department: '',
    designation: '',
    manager: '',
  },
  permissions: ['ess.self'],
};

describe('employee self-profile API', () => {
  beforeEach(async () => {
    sessionStorage.saveSelectedClient(client);
    await sessionStorage.saveSession(session);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    sessionStorage.clearSelectedClient();
    await sessionStorage.clearSession();
  });

  it('loads the complete editable profile and preserves intentionally empty values', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({ data: profile });

    await expect(essApiService.getSelfProfile()).resolves.toEqual(profile);
    expect(apiClient.get).toHaveBeenCalledWith('/api/ess/profile');
  });

  it('posts only the writable ESS profile contract', async () => {
    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: profile });

    await expect(essApiService.saveProfile(request)).resolves.toEqual(profile);
    expect(post).toHaveBeenCalledWith('/api/ess/profile', request);
    expect(Object.keys(post.mock.calls[0][1] as object).sort()).toEqual(
      Object.keys(request).sort(),
    );
  });

  it('refreshes the secure employee session after a successful save', async () => {
    jest.spyOn(essApiService, 'saveProfile').mockResolvedValue(profile);

    const action = await saveSelfProfile(request)(
      jest.fn(),
      () => ({}),
      undefined,
    );

    expect(action.type).toBe(saveSelfProfile.fulfilled.type);
    expect(sessionStorage.getSession()?.employee).toEqual(
      employeeFromSelfProfile(profile, session.employee),
    );
  });

  it.each([
    [
      {
        response: {
          status: 400,
          data: {
            error: 'Profile self-update is not enabled for your client.',
          },
        },
      },
      'PROFILE_EDIT_DISABLED',
    ],
    [
      {
        response: {
          status: 400,
          data: { error: 'Enter a valid email address.' },
        },
      },
      'PROFILE_EMAIL_INVALID',
    ],
    [{ response: { status: 401, data: {} } }, 'SESSION_EXPIRED'],
    [{ response: { status: 500, data: {} } }, 'SERVER_UNAVAILABLE'],
    [{ code: 'ECONNABORTED' }, 'REQUEST_TIMEOUT'],
    [{}, 'NETWORK_UNAVAILABLE'],
  ])('normalizes profile save failures to %s', async (failure, expected) => {
    jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue({ isAxiosError: true, ...failure });

    await expect(essApiService.saveProfile(request)).rejects.toThrow(expected);
  });
});
