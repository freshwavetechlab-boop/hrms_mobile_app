import React, { lazy, Suspense } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator } from 'react-native-paper';
import { CalendarCheck, Grid3X3, Home, LucideIcon, UserRound, ClipboardList } from 'lucide-react-native';
import { MainTabParamList } from './types';
import { useTranslation } from '../localization/useTranslation';
import { useAppColors } from '../theme/useAppTheme';
import { AuthenticatedHeader } from '../components/layout/AuthenticatedHeader';

const DashboardScreen = lazy(() => import('../screens/dashboard/DashboardScreen'));
const AttendanceScreen = lazy(() => import('../screens/attendance/AttendanceScreen'));
const RequestsScreen = lazy(() => import('../screens/requests/RequestsScreen'));
const ProfileScreen = lazy(() => import('../screens/profile/ProfileScreen'));
const MoreScreen = lazy(() => import('../screens/more/MoreScreen'));

const Tab = createBottomTabNavigator<MainTabParamList>();

const withSuspense = (Component: React.ComponentType) => () => (
  <Suspense fallback={<ActivityIndicator />}>
    <Component />
  </Suspense>
);

const tabIcon =
  (Icon: LucideIcon) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon color={color} size={size} strokeWidth={2.2} />;

const tabLabel =
  (label: string) =>
  ({ color }: { color: string }) =>
    (
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={1}
        style={[styles.tabLabel, { color }]}>
        {label}
      </Text>
    );

export const MainTabs = () => {
  const { t } = useTranslation();
  const colors = useAppColors();

  return (
    <View style={styles.container}>
      <AuthenticatedHeader />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 72,
            minHeight: 72,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarItemStyle: styles.tabItem,
        }}>
        <Tab.Screen
          name="Home"
          component={withSuspense(DashboardScreen)}
          options={{ title: t('dashboard'), tabBarIcon: tabIcon(Home), tabBarLabel: tabLabel(t('dashboard')) }}
        />
        <Tab.Screen
          name="Attendance"
          component={withSuspense(AttendanceScreen)}
          options={{ title: t('attendance'), tabBarIcon: tabIcon(CalendarCheck), tabBarLabel: tabLabel(t('attendance')) }}
        />
        <Tab.Screen
          name="Requests"
          component={withSuspense(RequestsScreen)}
          options={{ title: t('requests'), tabBarIcon: tabIcon(ClipboardList), tabBarLabel: tabLabel(t('requests')) }}
        />
        <Tab.Screen
          name="Profile"
          component={withSuspense(ProfileScreen)}
          options={{ title: t('profile'), tabBarIcon: tabIcon(UserRound), tabBarLabel: tabLabel(t('profile')) }}
        />
        <Tab.Screen
          name="More"
          component={withSuspense(MoreScreen)}
          options={{ title: t('more'), tabBarIcon: tabIcon(Grid3X3), tabBarLabel: tabLabel(t('more')) }}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabItem: {
    paddingHorizontal: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    maxWidth: 72,
    textAlign: 'center',
    width: '100%',
  },
});
