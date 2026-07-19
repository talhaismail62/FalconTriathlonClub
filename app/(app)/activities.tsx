import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';
import { Ionicons } from '@expo/vector-icons';

interface Activity {
  id: string;
  day: string;
  title: string;
  description: string;
  time: string; 
  image_url: string | null;
  created_at: string; 
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  function renderActivity({ item }: { item: Activity }) {
    return (
      <CardContainer>
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
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 50, fontSize: 16, fontWeight: '600' },
});