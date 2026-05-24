import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { colors } from '../theme/colors';

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
