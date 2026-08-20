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
import MapView, { Marker, Region } from 'react-native-maps';
import { GradientButton } from '@/components/UI';

const DEFAULT_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

/** Delay MapView until the modal animation has started — avoids native crashes on remount. */
const MAP_MOUNT_DELAY_MS = 200;

export type MapCoords = { latitude: number; longitude: number };

type Props = {
  visible: boolean;
  locationName: string;
  onClose: () => void;
  onConfirm: (coords: MapCoords) => void;
  onSuggestLocationName?: (name: string) => void;
};

export default function LocationMapPickerModal({
  visible,
  locationName,
  onClose,
  onConfirm,
  onSuggestLocationName,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<MapCoords | null>(null);
  const [mapMounted, setMapMounted] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMapMounted(false);
      setSearchQuery('');
      setSelectedCoords(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => setMapMounted(true), MAP_MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleMapSearch = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsSearching(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`,
        { headers: { 'User-Agent': 'ExpoClubApp/1.0' } }
      );
      const results = await response.json();

      if (results && results.length > 0) {
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lon = parseFloat(firstResult.lon);
        const newCoords = { latitude: lat, longitude: lon };
        setSelectedCoords(newCoords);

        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
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

        {mapMounted ? (
          <MapView
            ref={mapRef}
            style={styles.mapView}
            initialRegion={DEFAULT_REGION}
            onPress={(e) => setSelectedCoords(e.nativeEvent.coordinate)}
          >
            {selectedCoords && (
              <Marker coordinate={selectedCoords} title={locationName || 'Selected Venue'} />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color="#0d9488" />
          </View>
        )}

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
  mapView: { flex: 1, width: '100%' },
  mapPlaceholder: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  footer: { padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0' },
});
