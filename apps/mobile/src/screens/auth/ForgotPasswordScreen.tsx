import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type ForgotPasswordNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordNavigationProp>();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        'Failed to send reset link. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'Check your email for a password reset link.'
              : 'Enter your email address and we\'ll send you a link to reset your password.'}
          </Text>
        </View>

        {!sent ? (
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
            />

            <Button
              title="Send Reset Link"
              onPress={handleReset}
              loading={loading}
              variant="primary"
              size="lg"
              style={styles.resetButton}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Button
              title="Back to Login"
              onPress={() => navigation.navigate('Login')}
              variant="primary"
              size="lg"
            />
          </View>
        )}

        {!sent && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>Back to Login</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    gap: spacing.lg,
  },
  resetButton: {
    marginTop: spacing.sm,
  },
  backLink: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
