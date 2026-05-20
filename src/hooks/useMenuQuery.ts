import { useQuery } from '@tanstack/react-query';
import { menuService } from '../services/MenuService';
import type { MenuItem } from '../models/MenuItem';

export const MENU_QUERY_KEY = ['menu'] as const;

export function useMenuQuery() {
  return useQuery<MenuItem[], Error>({
    queryKey: MENU_QUERY_KEY,
    queryFn: async () => {
      await menuService.fetchMenuItems();
      return menuService.state.menuItems;
    },
  });
}
