import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';

interface Post {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

interface Activity {
  id: string;
  day: string;
  title: string;
  time: string;
}

interface JerseySizeEntry {
  email: string;
  name: string | null;
  running_size: string;
  running_quantity: number;
  cycling_size: string;
  cycling_quantity: number;
}

const INSTAGRAM_URL = 'https://www.instagram.com/falcontriathlonclub/';
const FACEBOOK_URL = 'https://www.facebook.com/falcontriathlonclub';

const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// How many sections of each kind the home page previews before "View all".
const POST_PREVIEW_COUNT = 3;
const ACTIVITY_PREVIEW_COUNT = 3;

// Simple, lightweight helper to turn database timestamps into friendly display text
function formatPostTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    // Format as "MMM DD, YYYY" for older posts
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// Activities recur weekly, so "how soon" is the distance to the next matching weekday.
// Returns null for a day we don't recognise, so the badge can be skipped entirely.
function daysUntilNext(day: string): number | null {
  const target = DAYS_ORDER.indexOf(day);
  if (target < 0) return null;

  // DAYS_ORDER is Monday-first; getDay() is Sunday-first.
  const today = (new Date().getDay() + 6) % 7;
  return (target - today + 7) % 7;
}

function formatCountdown(day: string): string | null {
  const diff = daysUntilNext(day);
  if (diff === null) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

// Orders activities by how soon they next occur rather than by fixed weekday,
// so the top of the list is always what's coming up next.
function sortByNextOccurrence(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    const aDiff = daysUntilNext(a.day);
    const bDiff = daysUntilNext(b.day);
    if (aDiff === null) return 1;
    if (bDiff === null) return -1;
    return aDiff - bDiff;
  });
}

export default function HomeTab() {
  const router = useRouter();
  const { session } = useAuth();
  const email = session?.user?.email ?? '';
  const [posts, setPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [jerseyModalVisible, setJerseyModalVisible] = useState(false);
  const [isSavingJersey, setIsSavingJersey] = useState(false);
  const [runningSize, setRunningSize] = useState('');
  const [runningQuantity, setRunningQuantity] = useState('1');
  const [cyclingSize, setCyclingSize] = useState('');
  const [cyclingQuantity, setCyclingQuantity] = useState('1');

  const [isAdmin, setIsAdmin] = useState(false);
  const [jerseyListModalVisible, setJerseyListModalVisible] = useState(false);
  const [isLoadingJerseyList, setIsLoadingJerseyList] = useState(false);
  const [jerseyEntries, setJerseyEntries] = useState<JerseySizeEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchHome();
      checkAdminStatus();
    }, [])
  );

  async function checkAdminStatus() {
    if (!email) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from('myusers')
      .select('is_admin')
      .eq('email', email.toLowerCase())
      .single();
    setIsAdmin(!!data?.is_admin);
  }

  async function fetchHome() {
    const [postsResult, activitiesResult] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, description, image_url, created_at')
        .eq('is_weekly_activity', false)
        .order('created_at', { ascending: false }),
      supabase.from('weekly_activities').select('id, day, title, time'),
    ]);

    if (!postsResult.error && postsResult.data) {
      setPosts(postsResult.data as Post[]);
    }
    if (!activitiesResult.error && activitiesResult.data) {
      setActivities(sortByNextOccurrence(activitiesResult.data as Activity[]));
    }

    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchHome();
  };

  // Linking.openURL rejects when no app can handle the URL; there's nothing
  // useful to tell the user at that point, so fail quietly rather than crash.
  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  async function openJerseyModal() {
    setJerseyModalVisible(true);
    if (!email) return;

    const { data } = await supabase
      .from('jersey_sizes')
      .select('running_size, running_quantity, cycling_size, cycling_quantity')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (data) {
      setRunningSize(data.running_size || '');
      setRunningQuantity(String(data.running_quantity || 1));
      setCyclingSize(data.cycling_size || '');
      setCyclingQuantity(String(data.cycling_quantity || 1));
    }
  }

  async function handleSaveJerseySizes() {
    if (!runningSize || !cyclingSize) {
      Alert.alert('Validation Error', 'Please select a size for both jerseys.');
      return;
    }

    setIsSavingJersey(true);
    try {
      const { data: profile } = await supabase
        .from('myusers')
        .select('name')
        .eq('email', email.toLowerCase())
        .single();

      const { error } = await supabase.from('jersey_sizes').upsert(
        {
          email: email.toLowerCase(),
          name: profile?.name || null,
          running_size: runningSize,
          running_quantity: parseInt(runningQuantity, 10) || 1,
          cycling_size: cyclingSize,
          cycling_quantity: parseInt(cyclingQuantity, 10) || 1,
        },
        { onConflict: 'email' }
      );

      if (error) throw error;

      setJerseyModalVisible(false);
      Alert.alert('Success', 'Your jersey sizes have been saved.');
    } catch (err: any) {
      Alert.alert('Error Saving', err.message || 'Could not save jersey sizes.');
    } finally {
      setIsSavingJersey(false);
    }
  }

  async function openJerseyListModal() {
    setJerseyListModalVisible(true);
    setIsLoadingJerseyList(true);

    const { data, error } = await supabase
      .from('jersey_sizes')
      .select('email, name, running_size, running_quantity, cycling_size, cycling_quantity')
      .order('email', { ascending: true });

    if (!error && data) {
      setJerseyEntries(data as JerseySizeEntry[]);
    }

    setIsLoadingJerseyList(false);
  }

  function renderPost(item: Post) {
    const imageUrl = item.image_url
      ? supabase.storage.from('post_images').getPublicUrl(item.image_url).data.publicUrl
      : null;

    return (
      <View key={item.id} style={styles.card}>
        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}
        <Text style={styles.postTitle}>{item.title}</Text>

        {/* Friendly Timestamp Metadata Row */}
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color="#94a3b8" />
          <Text style={styles.timeText}>{formatPostTime(item.created_at)}</Text>
        </View>

        <Text style={styles.postDescription} numberOfLines={3}>
          {item.description}
        </Text>
      </View>
    );
  }

  function renderActivity(item: Activity, isLast: boolean) {
    const countdown = formatCountdown(item.day);
    const dayLabel = (item.day || '').slice(0, 3).toUpperCase();

    return (
      <View key={item.id}>
        <View style={styles.activityRow}>
          {/* Day tile stands in for the calendar tile — activities recur weekly */}
          <View style={styles.dayTile}>
            <Text style={styles.dayTileText}>{dayLabel || '—'}</Text>
          </View>

          <View style={styles.activityBody}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.time ? (
              <View style={styles.activityMetaRow}>
                <Ionicons name="time-outline" size={13} color="#94a3b8" />
                <Text style={styles.activityMetaText}>{item.time}</Text>
              </View>
            ) : null}
          </View>

          {countdown ? (
            <View style={styles.countdownPill}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          ) : null}
        </View>

        {!isLast && <View style={styles.rowDivider} />}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#ffffff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      {/* SafeAreaView edges={['bottom']} prevents double padding since dynamic header handles top */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />
            }
          >
            {/* ── Announcements ── */}
            <Text style={styles.sectionTitle}>Announcements</Text>
            <View style={styles.headingSpacer} />

            {posts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No posts yet.</Text>
              </View>
            ) : (
              posts.slice(0, POST_PREVIEW_COUNT).map(renderPost)
            )}

            {/* ── Upcoming Activities ── */}
            <View style={[styles.sectionHeader, styles.sectionSpacing]}>
              <Text style={styles.sectionTitle}>Upcoming Activities</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/activities')}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>

            {activities.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No activity upcoming.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {activities
                  .slice(0, ACTIVITY_PREVIEW_COUNT)
                  .map((item, index, shown) =>
                    renderActivity(item, index === shown.length - 1)
                  )}
              </View>
            )}

            {/* ── Jersey Sizes ── */}
            <View style={[styles.sectionSpacing]}>
              <TouchableOpacity
                style={styles.jerseyBlock}
                activeOpacity={0.85}
                onPress={openJerseyModal}
              >
                <View style={styles.jerseyIconWrap}>
                  <Ionicons name="shirt-outline" size={24} color="#0d9488" />
                </View>
                <View style={styles.jerseyBody}>
                  <Text style={styles.jerseyTitle}>Add Jersey Sizes</Text>
                  <Text style={styles.jerseySubtitle}>Submit your running & cycling jersey sizes</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={[styles.jerseyBlock, styles.jerseyBlockSpacing]}
                  activeOpacity={0.85}
                  onPress={openJerseyListModal}
                >
                  <View style={styles.jerseyIconWrap}>
                    <Ionicons name="list-outline" size={24} color="#0d9488" />
                  </View>
                  <View style={styles.jerseyBody}>
                    <Text style={styles.jerseyTitle}>View Jersey Sizes</Text>
                    <Text style={styles.jerseySubtitle}>Admin only — see everyone's submissions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* ── Quick Links ── */}
            <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Quick Links</Text>
            <View style={styles.quickLinkRow}>
              <TouchableOpacity
                style={styles.quickLink}
                activeOpacity={0.8}
                accessibilityRole="link"
                accessibilityLabel="Open the club's Instagram"
                onPress={() => openLink(INSTAGRAM_URL)}
              >
                <Ionicons name="logo-instagram" size={30} color="#0d9488" />
                <Text style={styles.quickLinkText}>Instagram</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickLink}
                activeOpacity={0.8}
                accessibilityRole="link"
                accessibilityLabel="Open the club's Facebook"
                onPress={() => openLink(FACEBOOK_URL)}
              >
                <Ionicons name="logo-facebook" size={30} color="#0d9488" />
                <Text style={styles.quickLinkText}>Facebook</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={jerseyModalVisible}
        onRequestClose={() => setJerseyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Jersey Sizes</Text>
              <TouchableOpacity onPress={() => setJerseyModalVisible(false)}>
                <Text style={styles.closeModalText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Running Jersey Size</Text>
              <View style={styles.sizeRow}>
                {JERSEY_SIZES.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeChip, runningSize === size && styles.activeSizeChip]}
                    onPress={() => setRunningSize(size)}
                  >
                    <Text
                      style={[styles.sizeChipText, runningSize === size && styles.activeSizeChipText]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Running Jersey Quantity</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    setRunningQuantity((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))
                  }
                >
                  <Ionicons name="remove" size={18} color="#0d9488" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{runningQuantity}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    setRunningQuantity((q) => String((parseInt(q, 10) || 1) + 1))
                  }
                >
                  <Ionicons name="add" size={18} color="#0d9488" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, styles.fieldSpacing]}>Cycling Jersey Size</Text>
              <View style={styles.sizeRow}>
                {JERSEY_SIZES.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeChip, cyclingSize === size && styles.activeSizeChip]}
                    onPress={() => setCyclingSize(size)}
                  >
                    <Text
                      style={[styles.sizeChipText, cyclingSize === size && styles.activeSizeChipText]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Cycling Jersey Quantity</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    setCyclingQuantity((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))
                  }
                >
                  <Ionicons name="remove" size={18} color="#0d9488" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{cyclingQuantity}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() =>
                    setCyclingQuantity((q) => String((parseInt(q, 10) || 1) + 1))
                  }
                >
                  <Ionicons name="add" size={18} color="#0d9488" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSavingJersey && styles.disabledButton]}
                onPress={handleSaveJerseySizes}
                disabled={isSavingJersey}
              >
                {isSavingJersey ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Jersey Sizes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={jerseyListModalVisible}
        onRequestClose={() => setJerseyListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Jersey Sizes</Text>
              <TouchableOpacity onPress={() => setJerseyListModalVisible(false)}>
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </View>

            {isLoadingJerseyList ? (
              <ActivityIndicator size="large" color="#0d9488" style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {jerseyEntries.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No submissions yet.</Text>
                  </View>
                ) : (
                  jerseyEntries.map((entry) => (
                    <View key={entry.email} style={styles.jerseyEntryCard}>
                      <Text style={styles.jerseyEntryName}>{entry.name || entry.email}</Text>
                      {entry.name && <Text style={styles.jerseyEntryEmail}>{entry.email}</Text>}

                      <View style={styles.jerseyEntryRow}>
                        <Text style={styles.jerseyEntryLabel}>Running</Text>
                        <Text style={styles.jerseyEntryValue}>
                          {entry.running_size} × {entry.running_quantity}
                        </Text>
                      </View>
                      <View style={styles.jerseyEntryRow}>
                        <Text style={styles.jerseyEntryLabel}>Cycling</Text>
                        <Text style={styles.jerseyEntryValue}>
                          {entry.cycling_size} × {entry.cycling_quantity}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSpacing: { marginTop: 28 },
  headingSpacer: { height: 12 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: '#0f172a' },
  viewAll: { fontSize: 14, fontWeight: '700', color: '#0d9488' },

  // Shared card shell
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Posts
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  postTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 8 },
  timeText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  postDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },

  // Activities
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dayTile: {
    width: 54,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
  },
  dayTileText: { fontSize: 13, fontWeight: '800', color: '#0d9488' },
  activityBody: { flex: 1 },
  activityTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  activityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  activityMetaText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  countdownPill: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countdownText: { fontSize: 12, fontWeight: '700', color: '#0f766e' },
  rowDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },

  // Empty states
  emptyCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingVertical: 22,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  // Jersey sizes
  jerseyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  jerseyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyBody: { flex: 1 },
  jerseyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  jerseySubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  jerseyBlockSpacing: { marginTop: 12 },

  // Jersey sizes admin list
  jerseyEntryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  jerseyEntryName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  jerseyEntryEmail: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  jerseyEntryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  jerseyEntryLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  jerseyEntryValue: { fontSize: 13, fontWeight: '700', color: '#0d9488' },

  // Jersey modal
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
    marginBottom: 8,
  },
  fieldSpacing: { marginTop: 20 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sizeChip: {
    width: 52,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  activeSizeChip: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  sizeChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  activeSizeChipText: { color: '#ffffff' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontSize: 16, fontWeight: '700', color: '#0f172a', minWidth: 24, textAlign: 'center' },
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

  // Quick links
  quickLinkRow: { flexDirection: 'row', gap: 12 },
  quickLink: {
    width: 96,
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickLinkText: { fontSize: 13, fontWeight: '600', color: '#334155' },
});
