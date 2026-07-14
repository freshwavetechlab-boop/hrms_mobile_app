import React from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/feedback/ErrorBoundary';
import { store } from './src/store';
import { useAppSelector } from './src/store/hooks';
import { createPaperTheme } from './src/theme/paperTheme';
import { styles } from './src/theme/globalStyles';

const AppContent = () => {
  const darkMode = useAppSelector(state => state.preferences.darkMode);

  return (
    <PaperProvider theme={createPaperTheme(darkMode)}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </PaperProvider>
  );
};

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <Provider store={store}>
        <AppContent />
      </Provider>
    </GestureHandlerRootView>
  );
}

export default App;
