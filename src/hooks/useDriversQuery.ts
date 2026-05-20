import { useQuery } from '@tanstack/react-query';
import { driverService } from '../services/DriverService';
import type { AppUser } from '../models/AppUser';

export const DRIVERS_QUERY_KEY = ['drivers'] as const;

export function useDriversQuery(enabled: boolean = false) {
  return useQuery<AppUser[], Error>({
    queryKey: DRIVERS_QUERY_KEY,
    queryFn: async () => {
      await driverService.fetchDrivers();
      const state = driverService.state;
      if (state.onlineDrivers.length > 0) {
        return state.onlineDrivers;
      }
      return driverService.fetchAllDriverProfiles();
    },
    enabled,
  });
}
