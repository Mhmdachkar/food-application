import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../../constants/images';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useMenuQuery, MENU_QUERY_KEY } from '../../hooks/useMenuQuery';
import { menuService, type MenuItemPayload } from '../../services/MenuService';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import type { MenuItem, MenuCategory } from '../../models/MenuItem';

/* ── Constants ── */

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  burgers: 'Burgers', pizza: 'Pizza', sushi: 'Sushi', salads: 'Salads',
  pasta: 'Pasta', chicken: 'Chicken', seafood: 'Seafood', desserts: 'Desserts',
  drinks: 'Drinks', sides: 'Sides', breakfast: 'Breakfast', bowls: 'Bowls',
};
const ALL_CATEGORIES: MenuCategory[] = Object.keys(CATEGORY_LABELS) as MenuCategory[];

const BLANK_FORM = (): FormState => ({
  name: '', description: '', category: 'burgers', price: '',
  imageUrl: '', calories: '', prepTime: '15',
  tags: '', ingredients: '', allergens: '', isAvailable: true,
});

interface FormState {
  name: string;
  description: string;
  category: MenuCategory;
  price: string;
  imageUrl: string;
  calories: string;
  prepTime: string;
  tags: string;
  ingredients: string;
  allergens: string;
  isAvailable: boolean;
}

/* ── Form Modal ── */

interface MenuFormModalProps {
  visible: boolean;
  editing: MenuItem | null;
  form: FormState;
  saving: boolean;
  onChangeForm: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onClose: () => void;
}

function MenuFormModal({
  visible, editing, form, saving, onChangeForm, onSave, onClose,
}: MenuFormModalProps) {
  const insets = useSafeAreaInsets();

  const inputStyle = [styles.formInput];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Modal Header ── */}
        <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={onClose} style={styles.modalClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.modalTitle}>{editing ? 'Edit Item' : 'Add New Item'}</Text>
          <Pressable
            onPress={onSave}
            style={[styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.modalSaveBtnText}>Save</Text>
            }
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Basic Info ── */}
          <Text style={styles.sectionHeader}>Basic Info</Text>
          <Card style={styles.formCard}>
            <Text style={styles.fieldLabel}>Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={inputStyle}
              value={form.name}
              onChangeText={v => onChangeForm({ name: v })}
              placeholder="e.g. Classic Cheeseburger"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Description</Text>
            <TextInput
              style={[inputStyle, styles.multilineInput]}
              value={form.description}
              onChangeText={v => onChangeForm({ description: v })}
              placeholder="Short description shown to customers…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Price ($) <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={inputStyle}
              value={form.price}
              onChangeText={v => onChangeForm({ price: v })}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Image URL</Text>
            <TextInput
              style={inputStyle}
              value={form.imageUrl}
              onChangeText={v => onChangeForm({ imageUrl: v })}
              placeholder="https://…"
              placeholderTextColor={colors.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </Card>

          {/* ── Category ── */}
          <Text style={styles.sectionHeader}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipContent}
          >
            {ALL_CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                style={[styles.chip, form.category === cat && styles.chipActive]}
                onPress={() => onChangeForm({ category: cat })}
              >
                <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── Details ── */}
          <Text style={styles.sectionHeader}>Details</Text>
          <Card style={styles.formCard}>
            <View style={styles.detailRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.fieldLabel}>Calories</Text>
                <TextInput
                  style={inputStyle}
                  value={form.calories}
                  onChangeText={v => onChangeForm({ calories: v })}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Prep Time (min)</Text>
                <TextInput
                  style={inputStyle}
                  value={form.prepTime}
                  onChangeText={v => onChangeForm({ prepTime: v })}
                  placeholder="15"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </Card>

          {/* ── Tags & Info ── */}
          <Text style={styles.sectionHeader}>Tags & Info</Text>
          <Card style={styles.formCard}>
            <Text style={styles.fieldLabel}>Tags <Text style={styles.hint}>(comma-separated)</Text></Text>
            <TextInput
              style={inputStyle}
              value={form.tags}
              onChangeText={v => onChangeForm({ tags: v })}
              placeholder="spicy, popular, new"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Ingredients</Text>
            <TextInput
              style={[inputStyle, styles.multilineInput]}
              value={form.ingredients}
              onChangeText={v => onChangeForm({ ingredients: v })}
              placeholder="beef patty, cheddar, lettuce…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Allergens</Text>
            <TextInput
              style={inputStyle}
              value={form.allergens}
              onChangeText={v => onChangeForm({ allergens: v })}
              placeholder="gluten, dairy, nuts"
              placeholderTextColor={colors.textSecondary}
            />
          </Card>

          {/* ── Availability ── */}
          <Card style={[styles.formCard, styles.availRow]}>
            <View>
              <Text style={styles.availLabel}>Available for ordering</Text>
              <Text style={styles.availSub}>Customers can add this item to their cart</Text>
            </View>
            <Switch
              value={form.isAvailable}
              onValueChange={v => onChangeForm({ isAvailable: v })}
              trackColor={{ true: '#A7F3D0', false: colors.border }}
              thumbColor={form.isAvailable ? '#10B981' : '#9CA3AF'}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Main Screen ── */

export const AdminMenuScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: menuItems = [], isLoading } = useMenuQuery();

  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'ALL'>('ALL');
  const [searchText, setSearchText] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM());
  const [saving, setSaving] = useState(false);

  const patchForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  /* ── CRUD handlers ── */

  const openAdd = () => {
    setEditingItem(null);
    setForm(BLANK_FORM());
    setModalVisible(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price.toFixed(2),
      imageUrl: item.imageUrl,
      calories: item.calories ? item.calories.toString() : '',
      prepTime: item.prepTimeMinutes.toString(),
      tags: item.tags.join(', '),
      ingredients: item.ingredients.join(', '),
      allergens: item.allergens.join(', '),
      isAvailable: item.isAvailable,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name) {
      Alert.alert('Missing name', 'Please enter a name for the item.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price greater than 0.');
      return;
    }
    setSaving(true);
    const payload: MenuItemPayload = {
      name,
      description: form.description.trim(),
      category: form.category,
      price,
      imageUrl: form.imageUrl.trim(),
      calories: parseInt(form.calories, 10) || 0,
      prepTimeMinutes: parseInt(form.prepTime, 10) || 15,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      ingredients: form.ingredients.split(',').map(t => t.trim()).filter(Boolean),
      allergens: form.allergens.split(',').map(t => t.trim()).filter(Boolean),
      isAvailable: form.isAvailable,
    };
    let ok = false;
    if (editingItem) {
      ok = await menuService.updateItem(editingItem.id, payload);
    } else {
      const newId = await menuService.createItem(payload);
      ok = !!newId;
    }
    setSaving(false);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: [...MENU_QUERY_KEY] });
      setModalVisible(false);
    } else {
      Alert.alert('Error', 'Failed to save item. Check your connection and try again.');
    }
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Remove "${item.name}" from the menu? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(item.id);
            const ok = await menuService.deleteItem(item.id);
            setDeleting(null);
            if (ok) {
              queryClient.invalidateQueries({ queryKey: [...MENU_QUERY_KEY] });
            } else {
              Alert.alert('Error', 'Failed to delete item.');
            }
          },
        },
      ],
    );
  };

  const handleToggle = async (item: MenuItem) => {
    if (toggling) return;
    setToggling(item.id);
    try {
      await menuService.toggleAvailability(item.id, !item.isAvailable);
      queryClient.invalidateQueries({ queryKey: [...MENU_QUERY_KEY] });
    } finally {
      setToggling(null);
    }
  };

  /* ── Filtered data ── */

  const filtered = menuItems.filter(item => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (searchText.trim() && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const availableCount = menuItems.filter(i => i.isAvailable).length;

  /* ── Render item ── */

  const renderItem = ({ item }: { item: MenuItem }) => {
    const isDeleting = deleting === item.id;
    return (
      <Card style={styles.itemCard}>
        {/* Main row */}
        <View style={styles.itemRow}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.itemImage}
              placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
              transition={IMAGE_TRANSITION_MS}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
              <Text style={styles.itemImageEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
            </View>
          )}

          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemMeta}>{CATEGORY_LABELS[item.category]} · ${item.price.toFixed(2)}</Text>
            <Text style={styles.itemMeta}>{item.calories} cal · ~{item.prepTimeMinutes} min</Text>
            {!item.isAvailable && (
              <View style={styles.unavailablePill}>
                <Text style={styles.unavailablePillText}>Unavailable</Text>
              </View>
            )}
          </View>

          {toggling === item.id
            ? <ActivityIndicator color={colors.accent} style={{ marginLeft: 8 }} />
            : (
              <Switch
                value={item.isAvailable}
                onValueChange={() => handleToggle(item)}
                trackColor={{ true: '#A7F3D0', false: colors.border }}
                thumbColor={item.isAvailable ? '#10B981' : '#9CA3AF'}
                disabled={!!toggling || !!deleting}
              />
            )
          }
        </View>

        {/* Action row */}
        <View style={styles.itemActions}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => openEdit(item)}
            disabled={isDeleting}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.accent} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </Pressable>

          <View style={styles.actionDivider} />

          <Pressable
            style={[styles.actionBtn, isDeleting && { opacity: 0.4 }]}
            onPress={() => handleDelete(item)}
            disabled={isDeleting}
          >
            {isDeleting
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Ionicons name="trash-outline" size={14} color="#EF4444" />
            }
            <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  /* ── Render ── */

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Menu</Text>
          {!isLoading && (
            <Text style={styles.subtitle}>{availableCount}/{menuItems.length} available</Text>
          )}
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Item</Text>
        </Pressable>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search menu items…"
            placeholderTextColor={colors.textSecondary}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Category filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        <Pressable
          style={[styles.filterChip, selectedCategory === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedCategory('ALL')}
        >
          <Text style={[styles.filterText, selectedCategory === 'ALL' && styles.filterTextActive]}>
            All ({menuItems.length})
          </Text>
        </Pressable>
        {ALL_CATEGORIES.map(cat => {
          const count = menuItems.filter(i => i.category === cat).length;
          if (count === 0) return null;
          return (
            <Pressable
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
                {CATEGORY_LABELS[cat]} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {isLoading
        ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
                <Text style={styles.emptyText}>No items found</Text>
              </View>
            }
          />
        )
      }

      {/* ── Add / Edit Modal ── */}
      <MenuFormModal
        visible={modalVisible}
        editing={editingItem}
        form={form}
        saving={saving}
        onChangeForm={patchForm}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

/* ── Styles ── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Header */
  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.button,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  /* Search */
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardBackground, borderRadius: radii.input,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },

  /* Category chips */
  filterRow: { maxHeight: 48, marginBottom: spacing.md },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.button, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  filterTextActive: { color: '#FFFFFF' },

  /* List item card */
  itemCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 56, height: 56, borderRadius: radii.small, marginRight: spacing.md },
  itemImagePlaceholder: { backgroundColor: '#F5F5FA', alignItems: 'center', justifyContent: 'center' },
  itemImageEmoji: { fontSize: 24 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  unavailablePill: {
    alignSelf: 'flex-start', backgroundColor: '#FEF2F2',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4,
  },
  unavailablePillText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },

  /* Action row (Edit / Delete) */
  itemActions: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  actionDivider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: spacing.sm },

  /* Empty */
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },

  /* ── Modal ── */
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  modalClose: { padding: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalSaveBtn: {
    backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radii.button, minWidth: 64, alignItems: 'center',
  },
  modalSaveBtnDisabled: { opacity: 0.5 },
  modalSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  formScroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  formCard: { padding: spacing.md, marginBottom: spacing.sm },
  sectionHeader: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.sm, marginTop: spacing.md,
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  required: { color: colors.accent },
  hint: { fontSize: 11, fontWeight: '400', color: colors.textSecondary },

  formInput: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.input, paddingHorizontal: spacing.md, height: 44,
    fontSize: 14, color: colors.textPrimary,
  },
  multilineInput: { height: undefined, minHeight: 72, paddingTop: spacing.sm, paddingBottom: spacing.sm },

  detailRow: { flexDirection: 'row' },

  /* Category chips inside modal */
  chipRow: { maxHeight: 48, marginBottom: spacing.sm },
  chipContent: { paddingVertical: 2, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.button, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextActive: { color: '#FFFFFF' },

  /* Availability row */
  availRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  availLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  availSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
