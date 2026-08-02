import { Linking, Platform, Alert } from 'react-native';

/**
 * Opens a map URL in the native Google Maps / Apple Maps app,
 * or falls back to standard web browser navigation.
 */
export async function openMapLocation(url: string | null | undefined, title?: string) {
  if (!url) {
    Alert.alert('No Location', 'No map location link is available for this event.');
    return;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot Open Maps', 'Unable to open the map link on this device.');
    }
  } catch (error) {
    console.error('Error opening location:', error);
    Alert.alert('Error', 'Could not open the map location.');
  }
}