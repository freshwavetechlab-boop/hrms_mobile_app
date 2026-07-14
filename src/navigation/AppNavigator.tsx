import React, { lazy, Suspense, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator } from 'react-native-paper';
import { RootStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { checkFaceEnrollment, restoreSession } from '../store/slices/authSlice';
import { useNetworkMonitor } from '../hooks/useNetworkMonitor';
import { useAppLock } from '../hooks/useAppLock';
import { useLocationIntegrityMonitor } from '../hooks/useLocationIntegrityMonitor';
import { setLocale } from '../localization/i18n';
import { restoreClient } from '../store/slices/clientSlice';
import { useAppColors, useIsDarkMode } from '../theme/useAppTheme';

const SplashScreen = lazy(() => import('../screens/splash/SplashScreen'));
const ClientCodeScreen = lazy(() => import('../screens/auth/ClientCodeScreen'));
const LoginScreen = lazy(() => import('../screens/auth/LoginScreen'));
const FaceEnrollmentScreen = lazy(() => import('../screens/auth/FaceEnrollmentScreen'));
const AppLockScreen = lazy(() => import('../screens/auth/AppLockScreen'));
const AttendanceCaptureScreen = lazy(() => import('../screens/attendance/AttendanceCaptureScreen'));

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const dispatch = useAppDispatch();
  const { faceEnrollmentStatus, isAuthenticated, isRestoring, session } = useAppSelector(
    state => state.auth,
  );
  const isLocked = useAppSelector(state => state.security.isLocked);
  const preferences = useAppSelector(state => state.preferences);
  const colors = useAppColors();
  const isDarkMode = useIsDarkMode();
  const { isRestoring: isClientRestoring, selectedClient } = useAppSelector(state => state.client);

  useNetworkMonitor();
  useAppLock();
  useLocationIntegrityMonitor();

  useEffect(() => {
    dispatch(restoreSession());
    dispatch(restoreClient());
  }, [dispatch]);

  useEffect(() => {
    setLocale(preferences.locale);
  }, [preferences.locale]);

  useEffect(() => {
    if (isAuthenticated && session?.employee.id && faceEnrollmentStatus === 'unknown') {
      dispatch(checkFaceEnrollment(session.employee.id));
    }
  }, [dispatch, faceEnrollmentStatus, isAuthenticated, session?.employee.id]);

  if (isRestoring || isClientRestoring) {
    return (
      <>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.surfaceMuted} />
        <Suspense fallback={<ActivityIndicator />}>
          <SplashScreen />
        </Suspense>
      </>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...(isDarkMode ? DarkTheme : DefaultTheme),
        colors: {
          ...(isDarkMode ? DarkTheme.colors : DefaultTheme.colors),
          primary: colors.primary,
          background: colors.surfaceMuted,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.warning,
        },
      }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.surfaceMuted} />
      <Suspense fallback={<ActivityIndicator />}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            selectedClient ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : (
              <Stack.Screen name="ClientCode" component={ClientCodeScreen} />
            )
          ) : isLocked ? (
            <Stack.Screen name="AppLock" component={AppLockScreen} />
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="AttendanceCapture" component={AttendanceCaptureScreen} />
              <Stack.Screen name="FaceEnrollment" component={FaceEnrollmentScreen} />
            </>
          )}
        </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
};
