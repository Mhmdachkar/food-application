import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../../constants/images';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aiClient } from '../../services/AIClient';
import { useDataStore } from '../../state/DataStore';
import { useCartStore } from '../../state/CartStore';
import { colors, spacing, radii } from '../../theme/theme';
import type { MenuItem } from '../../models/MenuItem';

const MOOD_CHIPS = [
  { label: 'Comfort food', query: 'I want comfort food' },
  { label: 'Something spicy', query: 'I want something spicy' },
  { label: 'Light & healthy', query: 'I want something light and healthy' },
  { label: 'High protein', query: 'I need a high protein meal' },
  { label: 'Under $15', query: 'What can I get under fifteen dollars?' },
  { label: 'Quick meal', query: 'I need something quick' },
];

const SuggestionCard: React.FC<{
  item: MenuItem;
  index: number;
  onAdd: (item: MenuItem) => void;
  added: boolean;
}> = ({ item, index, onAdd, added }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={[
        cardStyles.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={cardStyles.image} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
      ) : (
        <View style={cardStyles.imagePlaceholder}>
          <Text style={cardStyles.imagePlaceholderText}>
            {item.category === 'burgers' ? '\uD83C\uDF54' :
             item.category === 'sushi' ? '\uD83C\uDF63' :
             item.category === 'pasta' ? '\uD83C\uDF5D' :
             item.category === 'salads' ? '\uD83E\uDD57' :
             item.category === 'desserts' ? '\uD83C\uDF70' :
             '\uD83C\uDF7D\uFE0F'}
          </Text>
        </View>
      )}
      <View style={cardStyles.info}>
        <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={cardStyles.description} numberOfLines={2}>{item.description}</Text>
        <View style={cardStyles.bottomRow}>
          <View style={cardStyles.priceTag}>
            <Text style={cardStyles.price}>${item.price.toFixed(2)}</Text>
          </View>
          <View style={cardStyles.metaRow}>
            <Text style={cardStyles.meta}>{item.calories} cal</Text>
            <Text style={cardStyles.metaDot}>{'\u00B7'}</Text>
            <Text style={cardStyles.meta}>{item.prepTimeMinutes}min</Text>
          </View>
        </View>
        {item.tags.length > 0 && (
          <View style={cardStyles.tagsRow}>
            {item.tags.slice(0, 3).map(tag => (
              <View key={tag} style={cardStyles.tag}>
                <Text style={cardStyles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [
          cardStyles.addBtn,
          added && cardStyles.addBtnDone,
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => onAdd(item)}
        disabled={added}
      >
        <Text style={[cardStyles.addBtnText, added && cardStyles.addBtnTextDone]}>
          {added ? '\u2713 Added' : '+ Add'}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.medium,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  image: {
    width: 90,
    height: 90,
    borderTopLeftRadius: radii.medium,
    borderBottomLeftRadius: radii.medium,
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: '#FFF0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 32 },
  info: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  priceTag: {
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { fontSize: 11, color: colors.textSecondary },
  metaDot: { fontSize: 11, color: colors.textSecondary, marginHorizontal: 3 },
  tagsRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 4,
  },
  tag: {
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tagText: { fontSize: 10, color: colors.textSecondary, fontWeight: '500' },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  addBtnDone: { backgroundColor: colors.success },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  addBtnTextDone: { color: '#FFF' },
});

export const VoiceAIScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { menuItems } = useDataStore();
  const { addItem } = useCartStore();
  const [text, setText] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [hasAsked, setHasAsked] = useState(false);

  const responseAnim = useRef(new Animated.Value(0)).current;

  const handleSubmit = useCallback(async (query?: string) => {
    const q = (query ?? text).trim();
    if (!q) return;
    setLoading(true);
    setHasAsked(true);
    setSuggested([]);
    setResponse(null);
    setAddedIds(new Set());

    try {
      const result = await aiClient.processVoiceCommand(q, menuItems);
      setResponse(result.message);
      setSuggested(result.suggestedItems);

      responseAnim.setValue(0);
      Animated.timing(responseAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } catch (err: any) {
      setResponse(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      if (!query) setText('');
    }
  }, [text, menuItems, responseAnim]);

  const handleAdd = useCallback(
    (item: MenuItem) => {
      addItem(item, 1);
      setAddedIds(prev => new Set(prev).add(item.id));
    },
    [addItem],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>{'\uD83E\uDDE0'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Food Assistant</Text>
          <Text style={styles.headerSubtitle}>
            Describe what you're in the mood for
          </Text>
        </View>
      </View>

      <FlatList
        data={suggested}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <SuggestionCard
            item={item}
            index={index}
            onAdd={handleAdd}
            added={addedIds.has(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Mood chips */}
            {!hasAsked && (
              <View style={styles.moodSection}>
                <Text style={styles.moodTitle}>Quick suggestions</Text>
                <View style={styles.moodGrid}>
                  {MOOD_CHIPS.map(chip => (
                    <Pressable
                      key={chip.label}
                      style={({ pressed }) => [
                        styles.moodChip,
                        pressed && styles.moodChipPressed,
                      ]}
                      onPress={() => handleSubmit(chip.query)}
                    >
                      <Text style={styles.moodChipText}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* AI Response */}
            {response && (
              <Animated.View
                style={[
                  styles.responseCard,
                  {
                    opacity: responseAnim,
                    transform: [
                      {
                        translateY: responseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.responseHeader}>
                  <Text style={styles.responseAvatar}>{'\uD83E\uDDE0'}</Text>
                  <Text style={styles.responseLabel}>AI Assistant</Text>
                </View>
                <Text style={styles.responseText}>{response}</Text>
              </Animated.View>
            )}

            {/* Loading */}
            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingText}>Finding the best options for you...</Text>
              </View>
            )}

            {/* Results count */}
            {suggested.length > 0 && (
              <Text style={styles.resultsLabel}>
                {suggested.length} suggestion{suggested.length !== 1 ? 's' : ''} for you
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          hasAsked && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{'\uD83D\uDD0D'}</Text>
              <Text style={styles.emptyText}>
                No matching items found. Try describing what you want differently.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="What are you in the mood for?"
          placeholderTextColor={colors.textSecondary}
          onSubmitEditing={() => handleSubmit()}
          returnKeyType="search"
          editable={!loading}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            (!text.trim() || loading) && styles.sendBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => handleSubmit()}
          disabled={!text.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.sendIcon}>{'\uD83D\uDD0D'}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarEmoji: { fontSize: 22 },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },

  /* List */
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },

  /* Mood chips */
  moodSection: { marginBottom: spacing.lg },
  moodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  moodChip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodChipPressed: {
    backgroundColor: '#FFF0E0',
    borderColor: colors.accent,
  },
  moodChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  /* Response */
  responseCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: radii.medium,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  responseAvatar: { fontSize: 16, marginRight: 6 },
  responseLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  responseText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },

  /* Loading */
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.medium,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  /* Results */
  resultsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 18 },
});

