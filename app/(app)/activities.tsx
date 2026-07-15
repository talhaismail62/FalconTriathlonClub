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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';

// Define the shape of our activity data
interface Activity {
  id: string;
  day: string;
  title: string;
  description: string;
  time: string;
}

// Ensure days sort chronologically Monday -> Sunday
const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Input Field States
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('*');

    if (!error && data) {
      // Sort days chronologically instead of alphabetically
      const sorted = data.sort((a: Activity, b: Activity) => 
        DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
      );
      setActivities(sorted as Activity[]);
    }
    setLoading(false);
  }

  // Handles inserting a new training schedule block into Supabase
  async function handleAddActivity() {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill out both the title and description.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('posts')
        .insert([
          {
            day: selectedDay,
            title: title.trim(),
            description: description.trim(),
            time: time.trim() || null, // Saves clean null if left blank
          }
        ]);

      if (error) throw error;

      Alert.alert('Success', 'Activity added to the weekly schedule.');
      
      // Clear Form Fields & Close Sheet
      setTitle('');
      setDescription('');
      setTime('');
      setSelectedDay('Monday');
      setModalVisible(false);
      
      // Refresh the main feed view layout
      await fetchActivities();
    } catch (err: any) {
      Alert.alert('Error Saving', err.message || 'Could not save layout details.');
    } finally {
      setIsSubmitting(false);
    }
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
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Weekly Activities</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
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
            ListEmptyComponent={
              <Text style={styles.emptyText}>No activities scheduled for this week.</Text>
            }
          />
        )}

        {/* COMPOSABLE ADD ACTIVITY ENTRY PANEL SHEET */}
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
                <Text style={styles.modalTitle}>New Club Activity</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.closeModalText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                
                {/* SELECT CHRONO DAY TARGET */}
                <Text style={styles.inputLabel}>Select Day</Text>
                <View style={styles.dayPickerContainer}>
                  {DAYS_ORDER.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.daySelectorChip,
                        selectedDay === day && styles.activeDayChip
                      ]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[
                        styles.dayChipText,
                        selectedDay === day && styles.activeDayChipText
                      ]}>
                        {day.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ACTIVITY TITLE STRINGS */}
                <Text style={styles.inputLabel}>Activity Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Swim Technique Drill"
                  placeholderTextColor="#94a3b8"
                  value={title}
                  onChangeText={setTitle}
                />

                {/* COMPRESSED TIME PARAMETERS */}
                <Text style={styles.inputLabel}>Time (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 6:00 AM - 7:30 AM"
                  placeholderTextColor="#94a3b8"
                  value={time}
                  onChangeText={setTime}
                />

                {/* RICH TEXT PARAGRAPH EXTENTIONS */}
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

                {/* INJECTION SUBMIT ACCELERATOR */}
                <TouchableOpacity 
                  style={[styles.submitButton, isSubmitting && styles.disabledButton]} 
                  onPress={handleAddActivity}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Publish Activity</Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  addButton: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 110, // Clears floating tab bars cleanly
  },
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
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  activityDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 50,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // MODAL SLIDE SHEET STYLING BLOCKS
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeModalText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
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
  activeDayChip: {
    backgroundColor: '#0d9488',
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  activeDayChipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
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
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
});