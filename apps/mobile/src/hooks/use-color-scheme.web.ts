import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeNoop = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * useSyncExternalStore reports "hydrated" as false for the server snapshot and true on the
 * client without a setState-in-effect cascade.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
