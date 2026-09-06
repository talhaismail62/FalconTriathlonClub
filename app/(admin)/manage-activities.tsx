import { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { CardContainer, SCREEN_GRADIENT } from '@/components/UI';
import AppTimePickerModal, { formatTime12h } from '@/components/AppTimePickerModal';
import LocationMapPickerModal, { MapCoords } from '@/components/LocationMapPickerModal';
import { openMapLocation } from '@/lib/location';
import {
  combineDateAndTime,
  formatActivityWhen,
  getActivityDate,
  isPastActivity,
  parseClockTime,
  sortActivitiesSoonestFirst,
  weekdayNameFromDate,
} from '@/lib/schedule';

interface Activity {
  id: string;
  day: string;
  title: string;
  description: string;
  time: string | null;
  location_name: string | null;
  location_url: string | null;
  activity_at?: string | null;
}

function parseTimeToDate(value: string | null): Date {
  const clock = parseClockTime(value);
  const date = new Date();
  if (!clock) return date;
  date.setHours(clock.hours, clock.minutes, 0, 0);
  return date;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ManageActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [activityDate, setActivityDate] = useState(new Date());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [timeValue, setTimeValue] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');

  const [showMapModal, setShowMapModal] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setLoading(true);
    const { data, error } = await supabase.from('weekly_activities').select('*');
    if (!error && data) {
      setActivities(sortActivitiesSoonestFirst(data as Activity[]));
    }
    setLoading(false);
  }

  function openMapPicker() {
    // Close the form modal first and wait for its dismiss animation.
    // Opening Map/WebView while another Modal is still animating can kill the app on Android.
    setModalVisible(false);
    setTimeout(() => setShowMapModal(true), 450);
  }

  function closeMapPicker() {
    setShowMapModal(false);
    setTimeout(() => setModalVisible(true), 300);
  }

  function confirmMapSelection(coords: MapCoords) {
    const url = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
    setLocationUrl(url);
    if (!locationName.trim()) {
      setLocationName('Pinned Location');
    }
    setShowMapModal(false);
    setTimeout(() => setModalVisible(true), 300);
  }

  function openCreate() {
    const now = new Date();
    setEditingId(null);
    setActivityDate(now);
    setTitle('');
    setDescription('');
    setTime('');
    setTimeValue(now);
    setLocationName('');
    setLocationUrl('');
    setModalVisible(true);
  }

  function openEdit(item: Activity) {
    setEditingId(item.id);
    const at = getActivityDate(item) ?? new Date();
    setActivityDate(at);
    setTitle(item.title);
    setDescription(item.description);
    setTime(item.time || '');
    setTimeValue(parseTimeToDate(item.time) || at);
    setLocationName(item.location_name || '');
    setLocationUrl(item.location_url || '');
    setModalVisible(true);
  }

  function onDateChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setActivityDate(selected);
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

    const activityAt = combineDateAndTime(activityDate, timeValue);
    // New activities must be upcoming; edits may keep/move a past archived session.
    if (!editingId && activityAt.getTime() < Date.now() - 60_000) {
      Alert.alert('Validation Error', 'Please pick a date and time in the future.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      day: weekdayNameFromDate(activityAt),
      title: title.trim(),
      description: description.trim(),
      time: time.trim(),
      location_name: locationName.trim() || null,
      location_url: locationUrl.trim() || null,
      activity_at: activityAt.toISOString(),
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
    const past = isPastActivity(item);
    return (
      <CardContainer>
        <View style={styles.cardHeader}>
          <Text style={[styles.dayBadge, past && styles.dayBadgePast]}>{formatActivityWhen(item)}</Text>
          {past ? <Text style={styles.pastLabel}>Archived</Text> : null}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {item.location_url && (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => openMapLocation(item.location_url, item.location_name || item.title)}
          >
            <Text style={styles.locationText}>📍 {item.location_name || 'View Location'} ↗</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </CardContainer>
    );
  }

  return (
    <LinearGradient
      colors={[...SCREEN_GRADIENT.colors]}
      locations={[...SCREEN_GRADIENT.locations]}
      start={SCREEN_GRADIENT.start}
      end={SCREEN_GRADIENT.end}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Activities</Text>
          <TouchableOpacity style={styles.addButton} onPress={openCreate}>
            <Ionicons name="add" size={22} color="#ffffff" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            renderItem={renderActivity}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No activities yet. Tap Add to create one.</Text>
            }
          />
        )}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Activity' : 'New Activity'}</Text>

                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color="#0d9488" />
                  <Text style={styles.timePickerText}>{formatDateLabel(activityDate)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={activityDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}
                {Platform.OS === 'ios' && showDatePicker && (
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.doneLink}>
                    <Text style={styles.doneLinkText}>Done</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.inputLabel}>Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#0d9488" />
                  <Text style={[styles.timePickerText, !time && styles.timePickerPlaceholder]}>
                    {time || 'Select a time'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Activity title"
                  placeholderTextColor="#94a3b8"
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                  placeholder="What should members know?"
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />

                <Text style={styles.inputLabel}>Location Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Liberty Park"
                  placeholderTextColor="#94a3b8"
                  value={locationName}
                  onChangeText={setLocationName}
                />

                <TouchableOpacity style={styles.mapTriggerButton} onPress={openMapPicker}>
                  <Ionicons name="map-outline" size={20} color="#0d9488" />
                  <Text style={styles.mapTriggerText}>
                    {locationUrl
                      ? 'Location Selected ✓ (Tap to Change)'
                      : '📍 Search & Select Location on Map'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.saveText}>{isSubmitting ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <AppTimePickerModal
          visible={showTimePicker}
          value={timeValue}
          onClose={() => setShowTimePicker(false)}
          onConfirm={(next) => {
            setTimeValue(next);
            setTime(formatTime12h(next));
            setShowTimePicker(false);
          }}
        />

        <LocationMapPickerModal
          visible={showMapModal}
          locationName={locationName}
          onClose={closeMapPicker}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0d9488',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: { color: '#ffffff', fontWeight: '700' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    backgroundColor: '#0d9488',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  dayBadgePast: { backgroundColor: '#94a3b8' },
  pastLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  locationButton: { marginTop: 10 },
  locationText: { fontSize: 13, fontWeight: '600', color: '#0d9488' },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  editText: { fontWeight: '700', color: '#0d9488' },
  deleteText: { fontWeight: '700', color: '#ef4444' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  timePickerText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  timePickerPlaceholder: { color: '#94a3b8', fontWeight: '400' },
  doneLink: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 4 },
  doneLinkText: { color: '#0d9488', fontWeight: '700' },
  mapTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#f0fdfa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  mapTriggerText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0d9488' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 8 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelText: { fontWeight: '700', color: '#475569' },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0d9488',
    alignItems: 'center',
  },
  saveText: { fontWeight: '700', color: '#ffffff' },
});
