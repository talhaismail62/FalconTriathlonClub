import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardContainer, GradientButton, SCREEN_GRADIENT } from '@/components/UI';
import LocationMapPickerModal, { MapCoords } from '@/components/LocationMapPickerModal';
import { openMapLocation } from '@/lib/location';
import {
  ANNOUNCEMENT_DURATION_OPTIONS,
  AnnouncementDurationHours,
  expiresAtFromDurationHours,
  isActiveAnnouncement,
  sortAnnouncementsNewestFirst,
} from '@/lib/schedule';

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
  created_at?: string | null;
  expires_at?: string | null;
}

export default function ManagePosts() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [durationHours, setDurationHours] = useState<AnnouncementDurationHours>(24);

  const [showMapModal, setShowMapModal] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    setPosts(sortAnnouncementsNewestFirst((data || []) as Post[]));
    setLoading(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  function confirmMapSelection(coords: MapCoords) {
    const url = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
    setLocationUrl(url);
    if (!locationName.trim()) {
      setLocationName('Pinned Location');
    }
    setShowMapModal(false);
  }

  async function handleCreate() {
    if (!title.trim()) return Alert.alert('Error', 'Title is required');

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
          console.error('Upload error:', uploadError);
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
      expires_at: expiresAtFromDurationHours(durationHours),
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setTitle('');
      setDescription('');
      setImageUri(null);
      setLocationName('');
      setLocationUrl('');
      setDurationHours(24);
      fetchPosts();
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('posts').delete().eq('id', id);
          fetchPosts();
        },
      },
    ]);
  }

  return (
    <LinearGradient
      colors={[...SCREEN_GRADIENT.colors]}
      locations={[...SCREEN_GRADIENT.locations]}
      start={SCREEN_GRADIENT.start}
      end={SCREEN_GRADIENT.end}
      style={styles.container}
    >
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 10 }]} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Club Content</Text>
          <Text style={styles.headerSubtitle}>Create, update, or delete posts</Text>
        </View>

        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Post Title"
                placeholderTextColor="#94a3b8"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Description"
                placeholderTextColor="#94a3b8"
                multiline
                value={description}
                onChangeText={setDescription}
              />

              <TextInput
                style={styles.input}
                placeholder="Location Name (e.g. Liberty Park)"
                placeholderTextColor="#94a3b8"
                value={locationName}
                onChangeText={setLocationName}
              />

              <TouchableOpacity style={styles.mapTriggerButton} onPress={() => setShowMapModal(true)}>
                <Ionicons name="map-outline" size={20} color="#0d9488" />
                <Text style={styles.mapTriggerText}>
                  {locationUrl ? 'Location Selected ✓ (Tap to Change)' : '📍 Search & Select Location on Map'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.durationLabel}>Show for</Text>
              <View style={styles.durationRow}>
                {ANNOUNCEMENT_DURATION_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.hours}
                    style={[
                      styles.durationChip,
                      durationHours === option.hours && styles.durationChipActive,
                    ]}
                    onPress={() => setDurationHours(option.hours)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        durationHours === option.hours && styles.durationChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <Text style={{ color: imageUri ? '#0d9488' : '#94a3b8', fontWeight: '600' }}>
                  {imageUri ? 'Image Selected ✓' : 'Attach Image (Optional)'}
                </Text>
              </TouchableOpacity>

              <GradientButton label={loading ? 'Saving...' : 'Create Post'} onPress={handleCreate} />

              <View style={styles.dividerRow}>
                <Text style={styles.dividerText}>Existing Updates & Feed</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CardContainer>
              {item.image_url && (
                <Image
                  source={{
                    uri: supabase.storage.from('post_images').getPublicUrl(item.image_url).data.publicUrl,
                  }}
                  style={styles.postImage}
                />
              )}
              <Text style={styles.postTitle}>{item.title}</Text>

              <View style={styles.badgeRow}>
                <Text style={styles.postTypeBadge}>
                  {item.is_weekly_activity ? '📅 Weekly Activity' : '📰 Announcement'}
                </Text>
                {!item.is_weekly_activity && (
                  <Text
                    style={[
                      styles.timeBadge,
                      !isActiveAnnouncement(item) && styles.expiredBadge,
                    ]}
                  >
                    {isActiveAnnouncement(item)
                      ? item.expires_at
                        ? `Expires ${new Date(item.expires_at).toLocaleString()}`
                        : 'No expiry'
                      : 'Expired'}
                  </Text>
                )}
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

        <LocationMapPickerModal
          visible={showMapModal}
          locationName={locationName}
          onClose={() => setShowMapModal(false)}
          onConfirm={confirmMapSelection}
          onSuggestLocationName={setLocationName}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 0 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 4 },
  form: { paddingVertical: 8, gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
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
  imagePicker: {
    padding: 15,
    borderWidth: 2,
    borderColor: '#ccfbf1',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  dividerRow: { marginTop: 12, borderBottomWidth: 1.5, borderColor: '#e2e8f0', paddingBottom: 6 },
  dividerText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  postImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  postTypeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0d9488',
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  timeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  expiredBadge: {
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
  },
  durationLabel: { fontSize: 13, fontWeight: '700', color: '#475569' },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  durationChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  durationChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  durationChipTextActive: { color: '#ffffff' },
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
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
});
