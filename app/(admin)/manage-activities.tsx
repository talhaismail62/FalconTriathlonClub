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
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';

interface Activity {
  id: string;
  day: string;
  title: string;
  description: string;
  time: string | null;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ManageActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');

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

  function openCreate() {
    setEditingId(null);
    setSelectedDay('Monday');
    setTitle('');
    setDescription('');
    setTime('');
    setModalVisible(true);
  }

  function openEdit(item: Activity) {
    setEditingId(item.id);
    setSelectedDay(item.day);
    setTitle(item.title);
    setDescription(item.description);
    setTime(item.time || '');
    setModalVisible(true);
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill out both the title and description.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      day: selectedDay,
      title: title.trim(),
      description: description.trim(),
      time: time.trim() || null,
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

              <Text style={styles.inputLabel}>Time (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 6:00 AM - 7:30 AM"
                placeholderTextColor="#94a3b8"
                value={time}
                onChangeText={setTime}
              />

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
});
