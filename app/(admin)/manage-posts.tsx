import { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Alert,
  Modal,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardContainer, GradientButton } from '@/components/UI';
import { openMapLocation } from '@/lib/location';

interface Post { 
  id: string; 
  title: string; 
  description: string; 
  image_url: string | null; 
  is_weekly_activity: boolean; 
  day?: string;
  time?: string;
  location_name?: string | null;
  location_url?: string | null;
}

const DEFAULT_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function ManagePosts() {
  const { session } = useAuth();
  const mapRef = useRef<MapView | null>(null);
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');

  // Map States
  const [showMapModal, setShowMapModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  // Search location on map using Nominatim Geocoder
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

        // Auto move map camera to searched spot
        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);

        if (!locationName.trim()) {
          const shortDisplayName = firstResult.display_name.split(',')[0];
          setLocationName(shortDisplayName);
        }
      } else {
        Alert.alert("Location Not Found", "Try typing a more specific place name or city.");
      }
    } catch (err) {
      Alert.alert("Search Error", "Could not fetch place coordinates.");
    } finally {
      setIsSearching(false);
    }
  };

  const confirmMapSelection = () => {
    if (selectedCoords) {
      const url = `https://www.google.com/maps/search/?api=1&query=${selectedCoords.latitude},${selectedCoords.longitude}`;
      setLocationUrl(url);
      if (!locationName.trim()) {
        setLocationName('Pinned Location');
      }
    }
    setShowMapModal(false);
  };

  async function handleCreate() {
    if (!title.trim()) return Alert.alert("Error", "Title is required");

    setLoading(true);
    let imagePath = null;

    if (imageUri && session?.user) {
      try {
        // Buddy's Fix: Use base64 arrayBuffer to avoid 0-byte uploads on Android
        const ext = (imageUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
        const path = `posts/${Date.now()}.${ext}`;
        const fileInstance = new File(imageUri);
        const base64 = await fileInstance.base64();
        const arrayBuffer = decode(base64);
        
        const { error: uploadError } = await supabase.storage
          .from('post_images')
          .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

        if (!uploadError) {
          imagePath = path;
        } else {
          console.error("Upload error:", uploadError);
        }
      } catch (err) {
        console.error(err);
      }
    }

    const { error } = await supabase.from('posts').insert({
      title: title.trim(),
      description: description.trim(),
      image_url: imagePath,
      is_weekly_activity: false,
      location_name: locationName.trim() || null,
      location_url: locationUrl.trim() || null,
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setTitle('');
      setDescription('');
      setImageUri(null);
      setLocationName('');
      setLocationUrl('');
      setSelectedCoords(null);
      setSearchQuery('');
      fetchPosts();
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    Alert.alert("Delete Post", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from('posts').delete().eq('id', id);
        fetchPosts();
      }}
    ]);
  }

  return (
    <LinearGradient colors={['#ffffff', '#0d9488']} start={{ x: 0.2, y: 0.2 }} end={{ x: 0.8, y: 0.8 }} style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 10 }]} edges={['bottom']}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Club Content</Text>
          <Text style={styles.headerSubtitle}>Create, update, or delete posts</Text>
        </View>

        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.form}>
              <TextInput style={styles.input} placeholder="Post Title" placeholderTextColor="#94a3b8" value={title} onChangeText={setTitle} />
              <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" placeholderTextColor="#94a3b8" multiline value={description} onChangeText={setDescription} />
              
              <TextInput 
                style={styles.input} 
                placeholder="Location Name (e.g. Liberty Park)" 
                placeholderTextColor="#94a3b8" 
                value={locationName} 
                onChangeText={setLocationName} 
              />

              {/* Map Trigger */}
              <TouchableOpacity style={styles.mapTriggerButton} onPress={() => setShowMapModal(true)}>
                <Ionicons name="map-outline" size={20} color="#0d9488" />
                <Text style={styles.mapTriggerText}>
                  {locationUrl ? "Location Selected ✓ (Tap to Change)" : "📍 Search & Select Location on Map"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <Text style={{ color: imageUri ? '#0d9488' : '#94a3b8', fontWeight: '600' }}>
                  {imageUri ? "Image Selected ✓" : "Attach Image (Optional)"}
                </Text>
              </TouchableOpacity>

              <GradientButton label={loading ? "Saving..." : "Create Post"} onPress={handleCreate} />
              
              <View style={styles.dividerRow}>
                <Text style={styles.dividerText}>Existing Updates & Feed</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CardContainer>
              {item.image_url && (
                <Image 
                  source={{ uri: supabase.storage.from('post_images').getPublicUrl(item.image_url).data.publicUrl }} 
                  style={styles.postImage} 
                />
              )}
              <Text style={styles.postTitle}>{item.title}</Text>
              
              <View style={styles.badgeRow}>
                <Text style={styles.postTypeBadge}>
                  {item.is_weekly_activity ? '📅 Weekly Activity' : '📰 Regular Post'}
                </Text>
                {item.is_weekly_activity && item.day && (
                  <Text style={styles.timeBadge}>
                    {item.day} at {item.time}
                  </Text>
                )}
              </View>

              {item.location_url && (
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={() => openMapLocation(item.location_url, item.location_name || item.title)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="navigate" size={14} color="#0d9488" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.location_name || 'Start Navigation'}
                  </Text>
                  <Ionicons name="open-outline" size={12} color="#0d9488" />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </CardContainer>
          )}
        />

        {/* MAP PICKER & SEARCH MODAL */}
        <Modal visible={showMapModal} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setShowMapModal(false)}>
                <Ionicons name="close" size={26} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {/* Search Bar on top of map */}
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

            <MapView 
              ref={mapRef}
              style={styles.mapView}
              initialRegion={DEFAULT_REGION}
              onPress={(e) => setSelectedCoords(e.nativeEvent.coordinate)}
            >
              {selectedCoords && (
                <Marker coordinate={selectedCoords} title={locationName || "Selected Venue"} />
              )}
            </MapView>

            <View style={styles.modalFooter}>
              <GradientButton 
                label={selectedCoords ? "Confirm Selected Location" : "Tap Map or Search Place"} 
                onPress={confirmMapSelection} 
              />
            </View>
          </SafeAreaView>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 0 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 2 },
  form: { paddingVertical: 8, gap: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  mapTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    borderRadius: 10,
    padding: 14,
  },
  mapTriggerText: { fontSize: 15, fontWeight: '700', color: '#0d9488' },
  imagePicker: { padding: 15, borderWidth: 2, borderColor: '#ccfbf1', borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  dividerRow: { marginTop: 16, borderBottomWidth: 1.5, borderColor: '#e2e8f0', paddingBottom: 6 },
  dividerText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  postImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  postTypeBadge: { fontSize: 12, fontWeight: '600', color: '#0d9488', backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  timeBadge: { fontSize: 12, fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdfa',
    borderColor: '#ccfbf1',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488',
  },
  deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 10 },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  searchOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
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
    color: '#0f172a'
  },
  searchButton: {
    width: 44,
    height: 44,
    backgroundColor: '#0d9488',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  mapView: { flex: 1, width: '100%' },
  modalFooter: { padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0' },
});