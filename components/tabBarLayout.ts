import { EdgeInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 60;

/**
 * Calculates the bottom offset position for the floating tab bar
 * accounting for safe area insets (e.g. iPhone home indicator / home bar).
 */
export function tabBarBottomOffset(insets: EdgeInsets): number {
  return Math.max(insets.bottom, 12);
}

/**
 * Calculates bottom margin clearance required by screen contents
 * so scroll views/inputs don't get covered by the floating tab bar.
 */
export function tabBarClearance(insets: EdgeInsets): number {
  return TAB_BAR_HEIGHT + tabBarBottomOffset(insets) + 12;
}
