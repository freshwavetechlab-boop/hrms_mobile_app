import { useEffect } from 'react';
import { attendanceRepository } from '../repositories/attendanceRepository';
import { setLastSyncedAt, setNetworkState, setSyncing } from '../store/slices/networkSlice';
import { useAppDispatch } from '../store/hooks';
import { networkService } from '../services/networkService';

export const useNetworkMonitor = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsubscribe = networkService.subscribe(async state => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      dispatch(
        setNetworkState({
          isConnected: Boolean(state.isConnected),
          isInternetReachable: state.isInternetReachable !== false,
          type: state.type,
        }),
      );

      if (isOnline) {
        dispatch(setSyncing(true));
        await attendanceRepository.syncPending();
        dispatch(setLastSyncedAt(new Date().toISOString()));
        dispatch(setSyncing(false));
      }
    });

    return unsubscribe;
  }, [dispatch]);
};
