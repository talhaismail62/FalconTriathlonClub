import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardContainer, GradientButton } from '@/components/UI';

interface Post { 
  id: string; 
  title: string; 
  description: string; 
  image_url: string | null; 
  is_weekly_activity: boolean; 
  day?: string;
  time?: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ManagePosts() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isWeeklyActivity, setIsWeeklyActivity] = useState(false);
  
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [dateValue, setDateValue] = useState<Date>(new Date());
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const insets = useSafeAreaInsets();

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

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateValue(selectedDate);
      const dayIndex = selectedDate.getDay();
      setDay(DAYS_OF_WEEK[dayIndex]);
      setTimeout(() => setShowTimePicker(true), 100);
    }
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const updatedDate = new Date(dateValue);
      updatedDate.setHours(selectedTime.getHours());
      updatedDate.setMinutes(selectedTime.getMinutes());
      setDateValue(updatedDate);

      const formattedTime = selectedTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      setTime(formattedTime);
    }
  };

  async function handleCreate() {
    if (!title.trim()) return Alert.alert("Error", "Title is required");
    if (isWeeklyActivity && (!day || !time)) {
      return Alert.alert("Error", "Please select a scheduled Date and Time.");
    }

    setLoading(true);
    let imagePath = null;

    if (imageUri && session?.user) {
      try {
        const blob = await (await fetch(imageUri)).blob();
        const ext = imageUri.split('.').pop();
        const path = `posts/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('post_images').upload(path, blob);
        if (!error) imagePath = path;
      } catch (err) {
        console.error(err);
      }
    }

    const { error } = await supabase.from('posts').insert({
      title, 
      description, 
      image_url: imagePath,
      is_weekly_activity: isWeeklyActivity,
      day: isWeeklyActivity ? day : null,
      time: isWeeklyActivity ? time : null
    });
    
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setTitle(''); setDescription(''); setImageUri(null); setIsWeeklyActivity(false); setDay(''); setTime('');
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
      {/* Safe Area Layout Wrapper to provide top spacing safely across all devices */}
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 5 }]} edges={['top']}>
        
        {/* Consistent Black Top Heading */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Portal</Text>
          <Text style={styles.headerSubtitle}>Manage Club Content</Text>
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
              
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => setIsWeeklyActivity(!isWeeklyActivity)}>
                <View style={[styles.checkbox, isWeeklyActivity && styles.checkboxActive]}>
                  {isWeeklyActivity && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>Mark as Weekly Activity</Text>
              </TouchableOpacity>

              {isWeeklyActivity && (
                <View style={styles.activityScheduleSection}>
                  <Text style={styles.sectionTitle}>Activity Schedule Info</Text>
                  <TouchableOpacity style={styles.pickerTriggerButton} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color="#0d9488" />
                    <Text style={styles.pickerTriggerText}>
                      {day && time ? `${day} at ${time}` : "Pick Date & Time"}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && <DateTimePicker value={dateValue} mode="date" display="default" onChange={onDateChange} />}
                  {showTimePicker && <DateTimePicker value={dateValue} mode="time" display="default" onChange={onTimeChange} />}
                </View>
              )}

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

              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </CardContainer>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' }, // Deep black title
  headerSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 2 },
  form: { paddingVertical: 8, gap: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  imagePicker: { padding: 15, borderWidth: 2, borderColor: '#ccfbf1', borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#0d9488', borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxActive: { backgroundColor: '#0d9488' },
  checkboxLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  activityScheduleSection: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  pickerTriggerButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 12 },
  pickerTriggerText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  dividerRow: { marginTop: 16, borderBottomWidth: 1.5, borderColor: '#e2e8f0', paddingBottom: 6 },
  dividerText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  postImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  postTypeBadge: { fontSize: 12, fontWeight: '600', color: '#0d9488', backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  timeBadge: { fontSize: 12, fontWeight: '600', color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 10 },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 }
});