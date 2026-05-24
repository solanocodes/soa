import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/stores/authStore';
import { colors } from './src/theme/colors';

// Keep splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

export default function App() {
  const [appReady, setAppReady] = React.useState(false);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    async function prepare() {
      try {
        // TODO: Load Montserrat fonts when font files are added to src/assets/fonts/
        // await Font.loadAsync({
        //   'Montserrat-Light': require('./src/assets/fonts/Montserrat-Light.ttf'),
        //   'Montserrat-Regular': require('./src/assets/fonts/Montserrat-Regular.ttf'),
        //   'Montserrat-Medium': require('./src/assets/fonts/Montserrat-Medium.ttf'),
        //   'Montserrat-SemiBold': require('./src/assets/fonts/Montserrat-SemiBold.ttf'),
        //   'Montserrat-Bold': require('./src/assets/fonts/Montserrat-Bold.ttf'),
        // });

        // Load stored auth tokens
        await loadStoredAuth();
      } catch (e) {
        console.warn('App preparation error:', e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, [loadStoredAuth]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={navigationTheme} onReady={onLayoutRootView}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <RootNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
