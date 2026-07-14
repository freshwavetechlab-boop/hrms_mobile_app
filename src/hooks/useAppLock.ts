import { useEffect } from 'react';
import { AppState } from 'react-native';
import { APP_CONFIG } from '../constants/app';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setBackgroundedAt, setLocked } from '../store/slices/securitySlice';

export const useAppLock = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (!isAuthenticated) {
        return;
      }
      if (nextState === 'background') {
        dispatch(setBackgroundedAt(Date.now()));
      }
      if (nextState === 'active') {
        dispatch((innerDispatch, getState) => {
          const backgroundedAt = getState().security.backgroundedAt;
          if (backgroundedAt && Date.now() - backgroundedAt > APP_CONFIG.appLockAfterMs) {
            innerDispatch(setLocked(true));
          }
          innerDispatch(setBackgroundedAt(undefined));
        });
      }
    });

    return () => subscription.remove();
  }, [dispatch, isAuthenticated]);
};
