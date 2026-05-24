import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const JOURNAL_URL = 'https://app.simplyoptionsacademy.com';

export function JournalScreen() {
  const handleOpenJournal = () => {
    Linking.openURL(JOURNAL_URL);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="book" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>Trading Journal</Text>

        <Text style={styles.description}>
          Track your trades in the SOA Trading Journal. Log entries, analyze
          performance, and improve your trading strategy with detailed insights.
        </Text>

        <Button
          title="Open Journal"
          onPress={handleOpenJournal}
          variant="primary"
          size="lg"
          style={styles.button}
        />

        <Text style={styles.hint}>
          Opens in your browser
        </Text>
      </View>
    </View>
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
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxxl,
  },
  button: {
    width: '100%',
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
