import type { EdgeInsets } from 'react-native-safe-area-context';

// The floating tab bar's geometry lives here so the navigator and any screen
// that has to clear it stay in sync. Changing the bar's size or float distance
// means changing it in this one place.
export const TAB_BAR_HEIGHT = 60;

/** Distance the bar floats above the bottom edge of the screen. */
export function tabBarBottomOffset(insets: EdgeInsets): number {
  return Math.max(insets.bottom, 8) + 6;
}

/**
 * Total space a screen must leave at the bottom so its content is not covered
 * by the floating bar. Includes the bar itself and the gap beneath it.
 *
 * Note this cannot come from useBottomTabBarHeight(): because the tab bar sets
 * an explicit height, React Navigation returns that number verbatim and never
 * accounts for the safe-area inset or the float, so it under-reports.
 */
export function tabBarClearance(insets: EdgeInsets): number {
  return TAB_BAR_HEIGHT + tabBarBottomOffset(insets);
}
