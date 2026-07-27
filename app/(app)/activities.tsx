import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';
import { Ionicons } from '@expo/vector-icons';
import { openMapLocation } from '@/lib/location';
import { useAuth } from '@/context/AuthContext';

interface Activity {
  id: string;
  day: string;
  title: string;
  description: string;
  time: string;
  location_name: string | null;
  location_url: string | null;
  image_url: string | null;
  created_at: string;
}

interface Rsvp {
  activity_id: string;
  email: string;
  name: string | null;
  status: 'Going' | 'Not Going' | 'Maybe';
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RSVP_OPTIONS: Rsvp['status'][] = ['Going', 'Not Going', 'Maybe'];

function formatActivityAge(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ActivitiesTab() {
  const { session } = useAuth();
  const email = session?.user?.email ?? '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rsvpsByActivity, setRsvpsByActivity] = useState<Record<string, Rsvp[]>>({});
  const [isSavingRsvp, setIsSavingRsvp] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [])
  );

  async function fetchActivities() {
    // Defect #26: Fetch from weekly_activities instead of posts
    const { data, error } = await supabase
      .from('weekly_activities')
      .select('*');

    if (!error && data) {
      const sorted = (data as Activity[]).sort((a, b) =>
        DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
      );
      setActivities(sorted);
    }
    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  async function toggleExpand(activityId: string) {
    if (expandedId === activityId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(activityId);

    const { data, error } = await supabase
      .from('activity_rsvps')
      .select('activity_id, email, name, status')
      .eq('activity_id', activityId);

    if (!error && data) {
      setRsvpsByActivity((prev) => ({ ...prev, [activityId]: data as Rsvp[] }));
    }
  }

  async function handleVote(activityId: string, status: Rsvp['status']) {
    if (!email) return;
    setIsSavingRsvp(true);

    const { data: profile } = await supabase
      .from('myusers')
      .select('name')
      .eq('email', email.toLowerCase())
      .single();

    const { error } = await supabase.from('activity_rsvps').upsert(
      {
        activity_id: activityId,
        email: email.toLowerCase(),
        name: profile?.name || null,
        status,
      },
      { onConflict: 'activity_id,email' }
    );

    setIsSavingRsvp(false);
    if (error) return;

    const { data } = await supabase
      .from('activity_rsvps')
      .select('activity_id, email, name, status')
      .eq('activity_id', activityId);

    if (data) {
      setRsvpsByActivity((prev) => ({ ...prev, [activityId]: data as Rsvp[] }));
    }
  }

  function renderActivity({ item }: { item: Activity }) {
    const isExpanded = expandedId === item.id;
    const rsvps = rsvpsByActivity[item.id] || [];
    const myVote = rsvps.find((r) => r.email.toLowerCase() === email.toLowerCase())?.status;

    return (
      <CardContainer>
        <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(item.id)}>
          <View style={styles.cardHeader}>
            <Text style={styles.dayBadge}>{item.day || 'Scheduled'}</Text>
            {item.time ? (
              <View style={styles.scheduleRow}>
                <Ionicons name="time" size={14} color="#0d9488" />
                <Text style={styles.scheduleText}>{item.time}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.activityTitle}>{item.title}</Text>

          <View style={styles.creationRow}>
            <Ionicons name="paper-plane-outline" size={12} color="#94a3b8" />
            <Text style={styles.creationText}>Posted {formatActivityAge(item.created_at)}</Text>
          </View>

          <Text style={styles.activityDescription}>{item.description}</Text>
        </TouchableOpacity>

        {item.location_url && (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => openMapLocation(item.location_url, item.location_name || item.title)}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={15} color="#0d9488" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location_name || 'View Location'}
            </Text>
            <Ionicons name="open-outline" size={13} color="#0d9488" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.expandToggle} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
          <Text style={styles.expandToggleText}>
            {isExpanded ? 'Hide RSVPs' : `RSVP${rsvps.length > 0 ? ` · ${rsvps.length}` : ''}`}
          </Text>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#0d9488" />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.rsvpSection}>
            <View style={styles.rsvpOptionRow}>
              {RSVP_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.rsvpChip, myVote === option && styles.rsvpChipActive]}
                  onPress={() => handleVote(item.id, option)}
                  disabled={isSavingRsvp}
                >
                  <Text style={[styles.rsvpChipText, myVote === option && styles.rsvpChipTextActive]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {rsvps.length === 0 ? (
              <Text style={styles.rsvpEmptyText}>No one has responded yet.</Text>
            ) : (
              RSVP_OPTIONS.map((status) => {
                const votersForStatus = rsvps.filter((r) => r.status === status);
                if (votersForStatus.length === 0) return null;
                return (
                  <View key={status} style={styles.rsvpGroup}>
                    <Text style={styles.rsvpGroupTitle}>{status} ({votersForStatus.length})</Text>
                    <Text style={styles.rsvpGroupNames}>
                      {votersForStatus.map((r) => r.name || r.email).join(', ')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}
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
        <Text style={styles.heading}>Weekly Activities</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderActivity}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>No activities scheduled for this week.</Text>
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  heading: { fontSize: 28, fontWeight: '800', color: '#0f172a', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 110 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayBadge: { fontSize: 11, fontWeight: '800', color: '#ffffff', backgroundColor: '#0d9488', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', textTransform: 'uppercase' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  activityTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  creationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 8 },
  creationText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  activityDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
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
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d9488',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  expandToggleText: { fontSize: 13, fontWeight: '700', color: '#0d9488' },
  rsvpSection: { marginTop: 12 },
  rsvpOptionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rsvpChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  rsvpChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  rsvpChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  rsvpChipTextActive: { color: '#ffffff' },
  rsvpEmptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
  rsvpGroup: { marginBottom: 8 },
  rsvpGroupTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  rsvpGroupNames: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 50, fontSize: 16, fontWeight: '600' },
});
