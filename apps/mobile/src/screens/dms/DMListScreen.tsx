import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface Thread {
  id: string;
  other_user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    created_at: string;
  } | null;
  unread_count: number;
}

export function DMListScreen() {
  const navigation = useNavigation<any>();

  const { data, isLoading } = useQuery({
    queryKey: ['dm-threads'],
    queryFn: async () => {
      const res = await api.get('/dms/threads');
      return res.data.threads as Thread[];
    },
  });

  const renderThread = ({ item }: { item: Thread }) => {
    const name = item.other_user.display_name || item.other_user.username;
    const initial = name[0]?.toUpperCase() || '?';

    return (
      <TouchableOpacity
        style={styles.threadRow}
        onPress={() => navigation.navigate('DMChat', {
          threadId: item.id,
          otherUserName: name,
        })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.threadInfo}>
          <Text style={styles.name}>{name}</Text>
          {item.last_message && (
            <Text style={styles.preview} numberOfLines={1}>
              {item.last_message.content}
            </Text>
          )}
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages</Text>
      <FlatList
        data={data}
        renderItem={renderThread}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No messages yet</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  threadInfo: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  preview: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
  },
});
