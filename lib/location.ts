import { Linking, Platform } from 'react-native';

export function openMapLocation(locationUrl: string | null, title?: string) {
  if (!locationUrl) return;

  // Extract lat,lng from Google Maps URLs or direct coordinates
  const coordsMatch = locationUrl.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);

  if (coordsMatch) {
    const lat = coordsMatch[1];
    const lng = coordsMatch[2];

    if (Platform.OS === 'android') {
      // Android: Launches Google Maps in direct Navigation Mode
      const navUrl = `google.navigation:q=${lat},${lng}`;
      Linking.canOpenURL(navUrl).then((supported) => {
        if (supported) {
          Linking.openURL(navUrl);
        } else {
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
        }
      });
      return;
    } else {
      // iOS: Launches Apple Maps / Google Maps directly in driving navigation mode
      const iosUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      Linking.openURL(iosUrl);
      return;
    }
  }

  // Fallback if URL is a plain text web link
  Linking.openURL(locationUrl);
}