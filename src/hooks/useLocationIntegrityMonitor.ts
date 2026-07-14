import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, BackHandler, Platform } from 'react-native';
import { locationIntegrityService, MOCK_LOCATION_MESSAGE } from '../services/locationIntegrityService';
import { logout } from '../store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const CHECK_INTERVAL_MS = 15000;

export const useLocationIntegrityMonitor = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const hasHandledViolation = useRef(false);
  const isChecking = useRef(false);

  const handleViolation = useCallback(async () => {
    if (hasHandledViolation.current) {
      return;
    }

    hasHandledViolation.current = true;
    await dispatch(logout()).unwrap();
    Alert.alert('Mock location blocked', MOCK_LOCATION_MESSAGE, [
      {
        text: 'Close app',
        onPress: () => {
          if (Platform.OS === 'android') {
            BackHandler.exitApp();
          }
        },
      },
    ]);
  }, [dispatch]);

  const checkIntegrity = useCallback(async () => {
    if (!isAuthenticated || hasHandledViolation.current || isChecking.current) {
      return;
    }

    try {
      isChecking.current = true;
      const isMocked = await locationIntegrityService.isMockLocationActive();
      if (isMocked) {
        await handleViolation();
      }
    } catch {
      // GPS can be temporarily unavailable. Do not log out unless Android reports a mocked provider.
    } finally {
      isChecking.current = false;
    }
  }, [handleViolation, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasHandledViolation.current = false;
      return undefined;
    }

    checkIntegrity();
    const interval = setInterval(checkIntegrity, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkIntegrity();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [checkIntegrity, isAuthenticated]);
};
