import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface MessageInputProps {
  onSend: (content: string, imageUri?: string) => void;
  isSending?: boolean;
}

export function MessageInput({ onSend, isSending = false }: MessageInputProps) {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !selectedImage) return;

    onSend(trimmed, selectedImage ?? undefined);
    setText('');
    setSelectedImage(null);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const canSend = text.trim().length > 0 || !!selectedImage;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handlePickImage}
          disabled={isSending}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={selectedImage ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          editable={!isSending}
        />

        <TouchableOpacity
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={canSend ? colors.text : colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
});
