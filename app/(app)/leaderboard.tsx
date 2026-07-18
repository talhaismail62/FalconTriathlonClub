import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = (process.env.EXPO_PUBLIC_LEADERBOARD_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Scope = 'monthly' | 'yearly';
type Gender = 'male' | 'female';

type Entry = {
  id?: number;
  username: string;
  score: number;
  run_score: number;
  ride_score: number;
  swim_score: number;
  run_count: number;
  ride_count: number;
  swim_count: number;
  run_distance: number;
  ride_distance: number;
  swim_distance: number;
  total_activities: number;
  total_distance: number;
};

type Board = { male: Entry[]; female: Entry[] };

const EMPTY_BOARD: Board = { male: [], female: [] };

function normalise(raw: any): Board {
  return {
    male: raw?.male ?? raw?.MaleLeaderBoard ?? [],
    female: raw?.female ?? raw?.FemaleLeaderBoard ?? [],
  };
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export default function LeaderboardTab() {
  const now = new Date();

  const [scope, setScope] = useState<Scope>('monthly');
  const [gender, setGender] = useState<Gender>('male');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [picker, setPicker] = useState<null | 'month' | 'year'>(null);

  const getCacheKey = useCallback(() => {
    return `@leaderboard_cache_${scope}_${month}_${year}`;
  }, [scope, month, year]);

  const fetchBoard = useCallback(async () => {
    setError(null);
    const url =
      scope === 'monthly'
        ? `${API_URL}/leaderboard?month=${month}&year=${year}`
        : `${API_URL}/Yleaderboard?year=${year}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const json = await res.json();
      const normalised = normalise(json);
      setBoard(normalised);
      await AsyncStorage.setItem(getCacheKey(), JSON.stringify(normalised));
    } catch (e: any) {
      setBoard(EMPTY_BOARD);
      setError(
        e?.message === 'Network request failed'
          ? `Could not reach the leaderboard server at ${API_URL}. Is it running?`
          : e?.message ?? 'Failed to load leaderboard.'
      );
    }
  }, [scope, month, year, getCacheKey]);

  useEffect(() => {
    let active = true;
    
    // Load from cache first for instant rendering (Defect #8)
    AsyncStorage.getItem(getCacheKey()).then((cached) => {
      if (cached && active) {
        try {
          setBoard(JSON.parse(cached));
        } catch {}
      }
    });

    setLoading(true);
    fetchBoard().finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [fetchBoard, getCacheKey]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchBoard();
    setRefreshing(false);
  }

  const list = board[gender];

  return (
    <LinearGradient
      colors={['#ffffff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      {/* edges={['bottom']} prevents double padding since dynamic header is active */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />
          }
        >
          <Text style={styles.heading}>Leaderboard</Text>

          <View style={styles.segment}>
            {(['monthly', 'yearly'] as Scope[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.segmentBtn, scope === s && styles.segmentBtnActive]}
                onPress={() => setScope(s)}
              >
                <Text style={[styles.segmentText, scope === s && styles.segmentTextActive]}>
                  {s === 'monthly' ? 'Monthly' : 'Yearly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.periodRow}>
            {scope === 'monthly' && (
              <TouchableOpacity style={styles.dropdown} onPress={() => setPicker('month')}>
                <Text style={styles.dropdownLabel}>Month</Text>
                <View style={styles.dropdownValueRow}>
                  <Text style={styles.dropdownValue}>{MONTHS[month - 1]}</Text>
                  <Ionicons name="chevron-down" size={18} color="#0d9488" />
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.dropdown} onPress={() => setPicker('year')}>
              <Text style={styles.dropdownLabel}>Year</Text>
              <View style={styles.dropdownValueRow}>
                <Text style={styles.dropdownValue}>{year}</Text>
                <Ionicons name="chevron-down" size={18} color="#0d9488" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.segment}>
            {(['male', 'female'] as Gender[]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.segmentBtn, gender === g && styles.segmentBtnActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.segmentText, gender === g && styles.segmentTextActive]}>
                  {g === 'male' ? 'Men' : 'Women'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Added list.length === 0 check so cached data doesn't disappear behind a spinner */}
          {loading && list.length === 0 ? (
            <ActivityIndicator color="#0d9488" size="large" style={{ marginTop: 40 }} />
          ) : error ? (
            <View style={styles.messageCard}>
              <Ionicons name="cloud-offline-outline" size={28} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : list.length === 0 ? (
            <View style={styles.messageCard}>
              <Ionicons name="trophy-outline" size={28} color="#94a3b8" />
              <Text style={styles.emptyText}>
                No scores for this {scope === 'monthly' ? 'month' : 'year'} yet.
              </Text>
            </View>
          ) : (
            list.map((entry, i) => (
              <LeaderRow key={entry.id ?? `${entry.username}-${i}`} rank={i + 1} entry={entry} />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{picker === 'month' ? 'Select Month' : 'Select Year'}</Text>
            <FlatList
              data={
                picker === 'month'
                  ? MONTHS.map((label, i) => ({ label, value: i + 1 }))
                  : YEARS.map((y) => ({ label: String(y), value: y }))
              }
              keyExtractor={(item) => String(item.value)}
              style={styles.modalList}
              renderItem={({ item }) => {
                const selected = picker === 'month' ? item.value === month : item.value === year;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, selected && styles.modalOptionActive]}
                    onPress={() => {
                      if (picker === 'month') setMonth(item.value);
                      else setYear(item.value);
                      setPicker(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, selected && styles.modalOptionTextActive]}>
                      {item.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#0d9488" />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

function LeaderRow({ rank, entry }: { rank: number; entry: Entry }) {
  const medal = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : null;
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={[styles.rankBadge, medal && { backgroundColor: medal }]}>
          <Text style={[styles.rankText, medal && { color: '#ffffff' }]}>{rank}</Text>
        </View>
        <Text style={styles.username} numberOfLines={1}>
          {entry.username || 'Unknown'}
        </Text>
        <View style={styles.scorePill}>
          <Text style={styles.scoreValue}>{entry.score.toFixed(1)}</Text>
          <Text style={styles.scoreLabel}>pts</Text>
        </View>
      </View>

      <View style={styles.sportRow}>
        <SportStat icon="walk" color="#0d9488" distance={entry.run_distance} count={entry.run_count} />
        <SportStat icon="bicycle" color="#2563eb" distance={entry.ride_distance} count={entry.ride_count} />
        <SportStat icon="water" color="#0891b2" distance={entry.swim_distance} count={entry.swim_count} />
      </View>
    </View>
  );
}

function SportStat({
  icon,
  color,
  distance,
  count,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  distance: number;
  count: number;
}) {
  return (
    <View style={styles.sportStat}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.sportDistance}>{(distance ?? 0).toFixed(1)} km</Text>
      <Text style={styles.sportCount}>{count ?? 0} act.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 }, // Reduced paddingTop since header handles top
  heading: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 16 },

  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#0d9488' },
  segmentText: { fontWeight: '700', color: '#0f766e' },
  segmentTextActive: { color: '#ffffff' },

  periodRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  dropdown: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginBottom: 2 },
  dropdownValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
    maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12, textAlign: 'center' },
  modalList: { flexGrow: 0 },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
  modalOptionActive: { backgroundColor: '#f0fdfa' },
  modalOptionText: { fontSize: 16, fontWeight: '600', color: '#334155' },
  modalOptionTextActive: { color: '#0d9488', fontWeight: '800' },

  messageCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 20, gap: 10 },
  errorText: { color: '#ef4444', fontWeight: '600', textAlign: 'center' },
  emptyText: { color: '#64748b', fontWeight: '600', textAlign: 'center' },
  retryBtn: { marginTop: 6, backgroundColor: '#0d9488', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: '#ffffff', fontWeight: '700' },

  row: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontWeight: '800', color: '#475569' },
  username: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  scorePill: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#f0fdfa', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 3 },
  scoreValue: { fontSize: 16, fontWeight: '800', color: '#0d9488' },
  scoreLabel: { fontSize: 11, fontWeight: '600', color: '#0d9488' },

  sportRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  sportStat: { flex: 1, alignItems: 'center', gap: 2 },
  sportDistance: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  sportCount: { fontSize: 11, color: '#94a3b8' },
});