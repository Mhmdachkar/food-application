import type { MenuCategory } from '../models/MenuItem';

export const CAT_EMOJI: Record<string, string> = {
  burgers: '\uD83C\uDF54',
  pizza: '\uD83C\uDF55',
  sushi: '\uD83C\uDF63',
  salads: '\uD83E\uDD57',
  pasta: '\uD83C\uDF5D',
  chicken: '\uD83C\uDF57',
  seafood: '\uD83E\uDD90',
  desserts: '\uD83C\uDF70',
  drinks: '\uD83E\uDD64',
  sides: '\uD83C\uDF5F',
  breakfast: '\uD83E\uDD5E',
  bowls: '\uD83C\uDF5C',
};

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  burgers: 'Burgers',
  pizza: 'Pizza',
  sushi: 'Sushi',
  salads: 'Salads',
  pasta: 'Pasta',
  chicken: 'Chicken',
  seafood: 'Seafood',
  desserts: 'Desserts',
  drinks: 'Drinks',
  sides: 'Sides',
  breakfast: 'Breakfast',
  bowls: 'Bowls',
};

export const CATEGORIES: MenuCategory[] = [
  'burgers',
  'pizza',
  'sushi',
  'salads',
  'pasta',
  'chicken',
  'seafood',
  'desserts',
  'drinks',
  'sides',
  'breakfast',
  'bowls',
];
