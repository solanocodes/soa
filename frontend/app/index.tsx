import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import { colors, typography } from '@/src/constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const timeout = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)/community');
      } else {
        router.replace('/(auth)/login');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SOA</Text>
      <Text style={styles.tagline}>Simply Options Academy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 8,
    marginBottom: 8,
  },
  tagline: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
