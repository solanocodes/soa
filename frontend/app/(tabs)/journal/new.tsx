import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useJournal } from '@/src/hooks/useJournal';
import { uploadApi } from '@/src/api/client';
import { colors, spacing, typography, borderRadius } from '@/src/constants/theme';

const SETUP_TYPES = [
  'Breakout',
  'Pullback',
  'Reversal',
  'Scalp',
  'Momentum',
  'Gap Fill',
  'Earnings Play',
  'Swing',
  'Other',
];

const EMOTIONS = [
  'Confident',
  'Fearful',
  'Greedy',
  'Patient',
  'Impulsive',
  'Calm',
  'Anxious',
  'Focused',
  'FOMO',
  'Disciplined',
];

export default function NewJournalEntryScreen() {
  const router = useRouter();
  const { createEntry, isCreating } = useJournal();

  const [ticker, setTicker] = useState('');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [setupType, setSetupType] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  };

  const handleAddScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'screenshot.jpg',
        } as any);

        const { data } = await uploadApi.uploadImage(formData);
        setScreenshots((prev) => [...prev, data.url]);
        setIsUploading(false);
      }
    } catch (err) {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!ticker.trim()) {
      Alert.alert('Missing Field', 'Please enter a ticker symbol');
      return;
    }
    if (!entryPrice || isNaN(Number(entryPrice))) {
      Alert.alert('Missing Field', 'Please enter a valid entry price');
      return;
    }
    if (!exitPrice || isNaN(Number(exitPrice))) {
      Alert.alert('Missing Field', 'Please enter a valid exit price');
      return;
    }
    if (!positionSize || isNaN(Number(positionSize))) {
      Alert.alert('Missing Field', 'Please enter a valid position size');
      return;
    }

    const entry = Number(entryPrice);
    const exit = Number(exitPrice);
    const size = Number(positionSize);
    const pnl = direction === 'LONG' ? (exit - entry) * size : (entry - exit) * size;
    const pnlPercentage = direction === 'LONG'
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100;

    createEntry(
      {
        ticker: ticker.trim().toUpperCase(),
        direction,
        entryPrice: entry,
        exitPrice: exit,
        positionSize: size,
        pnl,
        pnlPercentage,
        setupType: setupType || 'Other',
        notes: notes.trim() || undefined,
        emotions: selectedEmotions,
        screenshots: screenshots.map((url, i) => ({
          id: `screenshot-${i}`,
          type: 'image' as const,
          url,
          filename: `screenshot-${i}.jpg`,
          size: 0,
        })),
      },
      {
        onSuccess: () => {
          router.back();
        },
      }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Trade</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isCreating}
          style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ticker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ticker Symbol</Text>
            <TextInput
              style={styles.input}
              value={ticker}
              onChangeText={setTicker}
              placeholder="e.g. AAPL, SPY"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          {/* Direction Toggle */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Direction</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, direction === 'LONG' && styles.toggleButtonLong]}
                onPress={() => setDirection('LONG')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleText,
                    direction === 'LONG' && styles.toggleTextActive,
                  ]}
                >
                  LONG
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, direction === 'SHORT' && styles.toggleButtonShort]}
                onPress={() => setDirection('SHORT')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleText,
                    direction === 'SHORT' && styles.toggleTextActiveShort,
                  ]}
                >
                  SHORT
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Prices */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Entry Price</Text>
              <TextInput
                style={styles.input}
                value={entryPrice}
                onChangeText={setEntryPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Exit Price</Text>
              <TextInput
                style={styles.input}
                value={exitPrice}
                onChangeText={setExitPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Position Size */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Position Size (shares/contracts)</Text>
            <TextInput
              style={styles.input}
              value={positionSize}
              onChangeText={setPositionSize}
              placeholder="e.g. 100"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          {/* Setup Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Setup Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {SETUP_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, setupType === type && styles.chipActive]}
                    onPress={() => setSetupType(type)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.chipText, setupType === type && styles.chipTextActive]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="What was your thought process? What worked or didn't?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Emotions */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Emotions</Text>
            <View style={styles.emotionGrid}>
              {EMOTIONS.map((emotion) => (
                <TouchableOpacity
                  key={emotion}
                  style={[
                    styles.chip,
                    selectedEmotions.includes(emotion) && styles.chipActive,
                  ]}
                  onPress={() => toggleEmotion(emotion)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedEmotions.includes(emotion) && styles.chipTextActive,
                    ]}
                  >
                    {emotion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Screenshots */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Screenshots</Text>
            <View style={styles.screenshotRow}>
              {screenshots.map((url, index) => (
                <Image key={index} source={{ uri: url }} style={styles.screenshotThumb} />
              ))}
              <TouchableOpacity
                style={styles.addScreenshot}
                onPress={handleAddScreenshot}
                disabled={isUploading}
                activeOpacity={0.7}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.addScreenshotText}>+</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 60,
    gap: spacing.xl,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleButtonLong: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  toggleButtonShort: {
    backgroundColor: 'rgba(255, 68, 68, 0.13)',
    borderColor: colors.danger,
  },
  toggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.primary,
  },
  toggleTextActiveShort: {
    color: colors.danger,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  screenshotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  screenshotThumb: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  addScreenshot: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addScreenshotText: {
    fontSize: 24,
    color: colors.textMuted,
  },
});
