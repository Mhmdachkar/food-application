import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  DBCategory,
  DBItemModifierGroup,
  DBMenuItem,
  DBModifierGroup,
  DBModifierOption,
} from '../models/SupabaseModels';
import type {
  MenuItem,
  MenuCategory,
  ModifierGroup,
  ModifierOption,
  NutritionInfo,
} from '../models/MenuItem';
import { logger } from '../utils/logger';

export interface MenuServiceState {
  menuItems: MenuItem[];
  categories: DBCategory[];
  isLoading: boolean;
  errorMessage?: string;
}

const CATEGORY_MAP: Record<string, MenuCategory> = {
  Burgers: 'burgers',
  Pizza: 'pizza',
  Sushi: 'sushi',
  Salads: 'salads',
  Pasta: 'pasta',
  Chicken: 'chicken',
  Seafood: 'seafood',
  Desserts: 'desserts',
  Drinks: 'drinks',
  Sides: 'sides',
  Breakfast: 'breakfast',
  Bowls: 'bowls',
};

export class MenuService {
  private client: SupabaseClient;
  state: MenuServiceState = {
    menuItems: [],
    categories: [],
    isLoading: false,
  };

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  async fetchCategories(): Promise<void> {
    try {
      const { data, error } = await this.client
        .from('categories')
        .select('*')
        .order('sort_order')
        .returns<DBCategory[]>();
      if (error || !data) {
        logger.warn('[MENU] Failed to fetch categories:', error?.message);
        return;
      }
      logger.log('[MENU] Fetched', data.length, 'categories');
      this.state.categories = data;
    } catch (e: any) {
      logger.error('[MENU] Exception fetching categories:', e?.message);
    }
  }

  async fetchMenuItems(): Promise<void> {
    this.state.isLoading = true;
    try {
      await this.fetchCategories();

      const { data: dbItems, error: itemsErr } = await this.client
        .from('menu_items')
        .select('*')
        .returns<DBMenuItem[]>();
      if (itemsErr || !dbItems) {
        logger.warn('[MENU] Failed to fetch menu items:', itemsErr?.message);
        this.state.errorMessage = itemsErr?.message ?? 'Failed to load menu';
        this.state.isLoading = false;
        return;
      }
      logger.log('[MENU] Fetched', dbItems.length, 'menu items');

      const { data: dbGroups } = await this.client
        .from('modifier_groups')
        .select('*')
        .returns<DBModifierGroup[]>();

      const { data: dbOptions } = await this.client
        .from('modifier_options')
        .select('*')
        .returns<DBModifierOption[]>();

      const { data: dbLinks } = await this.client
        .from('item_modifier_groups')
        .select('*')
        .returns<DBItemModifierGroup[]>();

      const catIdToEnum: Record<string, MenuCategory> = {};
      for (const cat of this.state.categories) {
        const mapped = CATEGORY_MAP[cat.name];
        if (mapped) catIdToEnum[cat.id] = mapped;
      }

      const optionsByGroup: Record<string, DBModifierOption[]> = {};
      (dbOptions ?? []).forEach(opt => {
        if (!optionsByGroup[opt.group_id]) optionsByGroup[opt.group_id] = [];
        optionsByGroup[opt.group_id].push(opt);
      });

      const groupMap: Record<string, DBModifierGroup> = {};
      (dbGroups ?? []).forEach(g => {
        groupMap[g.id] = g;
      });

      const linksByItem: Record<string, DBItemModifierGroup[]> = {};
      (dbLinks ?? []).forEach(link => {
        if (!linksByItem[link.item_id]) linksByItem[link.item_id] = [];
        linksByItem[link.item_id].push(link);
      });

      this.state.menuItems = dbItems.map(dbItem => {
        const category =
          (catIdToEnum[dbItem.category_id ?? ''] as MenuCategory) ?? 'bowls';
        const ni = dbItem.nutrition_info ?? {};
        const nutritionInfo: NutritionInfo = {
          calories: ni.calories ?? 0,
          protein: ni.protein ?? 0,
          carbs: ni.carbs ?? 0,
          fat: ni.fat ?? 0,
          fiber: ni.fiber ?? 0,
          sugar: ni.sugar ?? 0,
        };
        const menuItem: MenuItem = {
          id: dbItem.id,
          name: dbItem.name,
          description: dbItem.description ?? '',
          price: dbItem.price,
          imageUrl: dbItem.image_url ?? '',
          category,
          tags: dbItem.tags ?? [],
          calories: dbItem.calories ?? 0,
          prepTimeMinutes: dbItem.prep_time_minutes ?? 15,
          rating: dbItem.rating ?? 4.5,
          reviewCount: dbItem.review_count ?? 0,
          isAvailable: dbItem.is_available ?? true,
          isLimitedTime: dbItem.is_limited_time ?? false,
          limitedTimeEnd: dbItem.limited_time_end,
          modifierGroups: [],
          nutritionInfo,
          ingredients: dbItem.ingredients ?? [],
          allergens: dbItem.allergens ?? [],
        };

        const links = linksByItem[dbItem.id] ?? [];
        const modifierGroups: ModifierGroup[] = links
          .map(link => {
            const group = groupMap[link.group_id];
            if (!group) return null;
            const optionsRaw = optionsByGroup[group.id] ?? [];
            const options: ModifierOption[] = optionsRaw.map(opt => ({
              id: opt.id,
              name: opt.name,
              priceAdjustment: opt.price_delta ?? 0,
            }));
            return {
              id: group.id,
              name: group.name,
              required: group.required ?? false,
              maxSelections: group.max_select ?? 1,
              options,
            };
          })
          .filter((g): g is ModifierGroup => g != null);

        return { ...menuItem, modifierGroups };
      });
    } catch (e: any) {
      logger.error('[MENU] Exception in fetchMenuItems:', e?.message, e);
      this.state.errorMessage = e?.message ?? 'Failed to load menu';
    } finally {
      this.state.isLoading = false;
    }
  }

  async toggleAvailability(itemId: string, isAvailable: boolean): Promise<void> {
    try {
      await this.client
        .from('menu_items')
        .update({ is_available: isAvailable })
        .eq('id', itemId);
      const idx = this.state.menuItems.findIndex(m => m.id === itemId);
      if (idx >= 0) {
        this.state.menuItems[idx].isAvailable = isAvailable;
      }
    } catch {
      // ignore
    }
  }
}

export const menuService = new MenuService();

