import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { GradientButton } from '@/components/UI';

const DEFAULT = { latitude: 31.5204, longitude: 74.3587 };

export type MapCoords = { latitude: number; longitude: number };

type Props = {
  visible: boolean;
  locationName: string;
  onClose: () => void;
  onConfirm: (coords: MapCoords) => void;
  onSuggestLocationName?: (name: string) => void;
};

/** OSM/Leaflet HTML map — avoids Android Google Maps SDK crashes when no API key is set. */
function buildMapHtml(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#f8fafc; }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lon}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var marker = null;
    function setPin(lat, lng, fly) {
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng]).addTo(map);
      if (fly) map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', latitude: lat, longitude: lng }));
      }
    }
    map.on('click', function (e) {
      setPin(e.latlng.lat, e.latlng.lng, false);
    });
    window.setMapLocation = function (lat, lng) {
      setPin(lat, lng, true);
    };
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  </script>
</body>
</html>`;
}

export default function LocationMapPickerModal({
  visible,
  locationName,
  onClose,
  onConfirm,
  onSuggestLocationName,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<MapCoords | null>(null);
  const [webReady, setWebReady] = useState(false);
  const [mapHtml, setMapHtml] = useState(() => buildMapHtml(DEFAULT.latitude, DEFAULT.longitude));

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSelectedCoords(null);
      setIsSearching(false);
      setWebReady(false);
      return;
    }
    // Fresh HTML each open so Leaflet remounts cleanly after the parent modal closes.
    setMapHtml(buildMapHtml(DEFAULT.latitude, DEFAULT.longitude));
  }, [visible]);

  const handleMapSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`,
        { headers: { 'User-Agent': 'FalconTriathlonClub/1.0' } }
      );
      const results = await response.json();

      if (results && results.length > 0) {
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lon = parseFloat(firstResult.lon);
        const newCoords = { latitude: lat, longitude: lon };
        setSelectedCoords(newCoords);

        webRef.current?.injectJavaScript(
          `window.setMapLocation(${lat}, ${lon}); true;`
        );

        if (!locationName.trim() && onSuggestLocationName) {
          const shortDisplayName = firstResult.display_name.split(',')[0];
          onSuggestLocationName(shortDisplayName);
        }
      } else {
        Alert.alert('Location Not Found', 'Try typing a more specific place name or city.');
      }
    } catch {
      Alert.alert('Search Error', 'Could not fetch place coordinates.');
    } finally {
      setIsSearching(false);
    }
  };

  const onWebMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'ready') {
        setWebReady(true);
      } else if (data?.type === 'select') {
        setSelectedCoords({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
        });
      }
    } catch {
      // ignore malformed messages
    }
  };

  const handleConfirm = () => {
    if (!selectedCoords) {
      Alert.alert('No Location Picked', 'Tap a spot on the map or search a place first.');
      return;
    }
    onConfirm(selectedCoords);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Location</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Ionicons name="close" size={26} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchOverlay}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search place, area or landmark..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleMapSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleMapSearch}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="search" size={18} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrap}>
          {visible ? (
            <WebView
              key={mapHtml.slice(0, 40)}
              ref={webRef}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={styles.mapView}
              onMessage={onWebMessage}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              mixedContentMode="always"
            />
          ) : null}
          {!webReady && (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#0d9488" />
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <GradientButton
            label={selectedCoords ? 'Confirm Selected Location' : 'Tap Map or Search Place'}
            onPress={handleConfirm}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  searchOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  searchButton: {
    width: 44,
    height: 44,
    backgroundColor: '#0d9488',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapWrap: { flex: 1, width: '100%' },
  mapView: { flex: 1, width: '100%', backgroundColor: '#f8fafc' },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  footer: { padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0' },
});
