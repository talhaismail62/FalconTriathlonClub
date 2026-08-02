import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import MapView, { Marker, Region } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { CardContainer, GradientButton } from '@/components/UI';
import { openMapLocation } from '@/lib/location';

interface Activity {
  id: string;
  day: string;
  title: string;
  description: string;
  time: string | null;
  location_name: string | null;
  location_url: string | null;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

// Matches the format used by manage-posts.tsx so both screens store time the same way.
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Existing rows may hold free text ("6:00 AM - 7:30 AM"), so fall back to the
// current time when the stored value isn't a simple clock time.
function parseTimeToDate(value: string | null): Date {
  const match = value?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return new Date();

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export default function ManageActivities() {
  const mapRef = useRef<MapView | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [timeValue, setTimeValue] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');

  // Map States
  const [showMapModal, setShowMapModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setTimeValue(selectedTime);
      setTime(formatTime(selectedTime));
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setLoading(true);
    const { data, error } = await supabase.from('weekly_activities').select('*');
    if (!error && data) {
      const sorted = (data as Activity[]).sort(
        (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
      );
      setActivities(sorted);
    }
    setLoading(false);
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
    if (!selectedCoords) {
      Alert.alert('No Location Picked', 'Tap a spot on the map or search a place first.');
      return;
    }
    if (selectedCoords) {
      const url = `https://www.google.com/maps/search/?api=1&query=${selectedCoords.latitude},${selectedCoords.longitude}`;
      setLocationUrl(url);
      if (!locationName.trim()) {
        setLocationName('Pinned Location');
      }
    }
    setShowMapModal(false);
  };

  function openCreate() {
    setEditingId(null);
    setSelectedDay('Monday');
    setTitle('');
    setDescription('');
    setTime('');
    setTimeValue(new Date());
    setLocationName('');
    setLocationUrl('');
    setSelectedCoords(null);
    setSearchQuery('');
    setModalVisible(true);
  }

  function openEdit(item: Activity) {
    setEditingId(item.id);
    setSelectedDay(item.day);
    setTitle(item.title);
    setDescription(item.description);
    setTime(item.time || '');
    // Open the clock on the saved time rather than "now" when editing.
    setTimeValue(parseTimeToDate(item.time));
    setLocationName(item.location_name || '');
    setLocationUrl(item.location_url || '');
    setSelectedCoords(null);
    setSearchQuery('');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill out both the title and description.');
      return;
    }

    if (!time.trim()) {
      Alert.alert('Validation Error', 'Please select a time for this activity.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      day: selectedDay,
      title: title.trim(),
      description: description.trim(),
      time: time.trim(),
      location_name: locationName.trim() || null,
      location_url: locationUrl.trim() || null,
    };

    try {
      const { error } = editingId
        ? await supabase.from('weekly_activities').update(payload).eq('id', editingId)
        : await supabase.from('weekly_activities').insert([payload]);

      if (error) throw error;

      setModalVisible(false);
      await fetchActivities();
    } catch (err: any) {
      Alert.alert('Error Saving', err.message || 'Could not save activity.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('weekly_activities').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchActivities();
        },
      },
    ]);
  }

  function renderActivity({ item }: { item: Activity }) {
    return (
      <CardContainer>
        <View style={styles.cardHeader}>
          <Text style={styles.dayBadge}>{item.day}</Text>
          {item.time ? <Text style={styles.timeText}>🕒 {item.time}</Text> : null}
        </View>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDescription}>{item.description}</Text>

        {item.location_url && (
          <TouchableOpacity
            style={styles.locationBadge}
            onPress={() => openMapLocation(item.location_url, item.location_name || item.title)}
            activeOpacity={0.7}
          >
            <Text style={styles.locationBadgeText}>
              📍 {item.location_name || 'View Location'} ↗
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </CardContainer>
    );
  }

  return (
    <LinearGradient
      colors={['#ffffff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.7}>
            <Text style={styles.addButtonText}>+ Add Activity</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderActivity}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No activities scheduled yet.</Text>}
          />
        )}
      </SafeAreaView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Activity' : 'New Activity'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeModalText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Select Day</Text>
              <View style={styles.dayPickerContainer}>
                {DAYS_ORDER.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.daySelectorChip, selectedDay === day && styles.activeDayChip]}
                    onPress={() => setSelectedDay(day)}
                  >
                    <Text
                      style={[styles.dayChipText, selectedDay === day && styles.activeDayChipText]}
                    >
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Activity Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Swim Technique Drill"
                placeholderTextColor="#94a3b8"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Time</Text>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={20} color="#0d9488" />
                <Text style={[styles.timePickerText, !time && styles.timePickerPlaceholder]}>
                  {time || 'Select a time'}
                </Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={timeValue}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              <Text style={styles.inputLabel}>Location Name (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Liberty Roundabout / Main Track"
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

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Provide running loops, track distances, or coach information..."
                placeholderTextColor="#94a3b8"
                multiline={true}
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                onPress={handleSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingId ? 'Save Changes' : 'Publish Activity'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MAP PICKER & SEARCH MODAL */}
      <Modal visible={showMapModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>Select Location</Text>
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

          <View style={styles.mapModalFooter}>
            <GradientButton
              label={selectedCoords ? "Confirm Selected Location" : "Tap Map or Search Place"}
              onPress={confirmMapSelection}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  addButton: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    backgroundColor: '#0d9488',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  activityTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  activityDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  locationBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdfa',
    borderColor: '#ccfbf1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d9488',
  },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  editBtn: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editText: { color: '#0d9488', fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 50,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  closeModalText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dayPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  daySelectorChip: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  activeDayChip: { backgroundColor: '#0d9488' },
  dayChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  activeDayChipText: { color: '#ffffff', fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    marginBottom: 16,
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  timePickerText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  timePickerPlaceholder: { color: '#94a3b8', fontWeight: '400' },
  mapTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  mapTriggerText: { fontSize: 15, fontWeight: '700', color: '#0d9488' },
  submitButton: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapModalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
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
  mapModalFooter: { padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0' },
});
