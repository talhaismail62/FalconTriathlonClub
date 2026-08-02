import { useState, useCallback, useMemo } from 'react';
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '@/context/AuthContext';
import { openMapLocation } from '@/lib/location';

interface Post {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  location_name: string | null;
  location_url: string | null;
  created_at: string;
}

interface Activity {
  id: string;
  day: string;
  title: string;
  time: string;
  location_name: string | null;
  location_url: string | null;
}

interface JerseySizeEntry {
  email: string;
  name: string | null;
  running_size: string;
  running_quantity: number;
  cycling_size: string;
  cycling_quantity: number;
}

interface Member {
  email: string;
  name: string | null;
}

interface BillParticipant {
  id: string;
  bill_id: string;
  email: string;
  name: string | null;
  guest_count: number;
  has_paid: boolean;
}

interface Bill {
  id: string;
  created_by: string;
  name: string | null;
  description: string | null;
  amount: number;
  bill_date: string;
  created_at: string;
  participants: BillParticipant[];
}

interface Rsvp {
  activity_id: string;
  email: string;
  name: string | null;
  status: 'Going' | 'Not Going' | 'Maybe';
}

const INSTAGRAM_URL = 'https://www.instagram.com/falcontriathlonclub/';
const FACEBOOK_URL = 'https://www.facebook.com/falcontriathlonclub';

const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const RSVP_OPTIONS: Rsvp['status'][] = ['Going', 'Not Going', 'Maybe'];

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// How many sections of each kind the home page previews before "View all".
const POST_PREVIEW_COUNT = 3;
const ACTIVITY_PREVIEW_COUNT = 3;

// Totals the quantities ordered per size, so the admin view can show how many of
// each size to order. Sizes with no orders stay in the result as 0 — a size that
// nobody picked is useful information when you're placing the order.
function tallyJerseySizes(
  entries: JerseySizeEntry[],
  kind: 'running' | 'cycling'
): { size: string; quantity: number }[] {
  const sizeField = kind === 'running' ? 'running_size' : 'cycling_size';
  const quantityField = kind === 'running' ? 'running_quantity' : 'cycling_quantity';

  return JERSEY_SIZES.map((size) => ({
    size,
    quantity: entries
      .filter((entry) => entry[sizeField] === size)
      .reduce((sum, entry) => sum + (entry[quantityField] || 0), 0),
  }));
}

// Escapes a value for CSV: wrap in quotes and double any embedded quotes, so
// names containing commas or quotes don't break the column layout.
function toCsvCell(value: string | number | null): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildJerseyCsv(entries: JerseySizeEntry[]): string {
  const runningTally = tallyJerseySizes(entries, 'running');
  const cyclingTally = tallyJerseySizes(entries, 'cycling');

  const rows: string[] = [];

  rows.push(
    ['Name', 'Email', 'Cycling Size', 'Cycling Quantity', 'Running Size', 'Running Quantity']
      .map(toCsvCell)
      .join(',')
  );

  entries.forEach((entry) => {
    rows.push(
      [
        entry.name || '',
        entry.email,
        entry.cycling_size,
        entry.cycling_quantity,
        entry.running_size,
        entry.running_quantity,
      ]
        .map(toCsvCell)
        .join(',')
    );
  });

  // Aggregated totals live below the per-member rows, separated by a blank line
  // so spreadsheet apps keep the member table intact when sorting/filtering.
  rows.push('');
  rows.push(['Aggregated Totals'].map(toCsvCell).join(','));
  rows.push(['Jersey Type', 'Size', 'Total Quantity'].map(toCsvCell).join(','));

  cyclingTally.forEach(({ size, quantity }) => {
    rows.push(['Cycling', size, quantity].map(toCsvCell).join(','));
  });
  runningTally.forEach(({ size, quantity }) => {
    rows.push(['Running', size, quantity].map(toCsvCell).join(','));
  });

  const cyclingTotal = cyclingTally.reduce((sum, item) => sum + item.quantity, 0);
  const runningTotal = runningTally.reduce((sum, item) => sum + item.quantity, 0);

  rows.push(['Cycling', 'All sizes', cyclingTotal].map(toCsvCell).join(','));
  rows.push(['Running', 'All sizes', runningTotal].map(toCsvCell).join(','));
  rows.push(['Members submitted', '', entries.length].map(toCsvCell).join(','));

  return rows.join('\n');
}

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
  const [isExportingJerseyCsv, setIsExportingJerseyCsv] = useState(false);

  const runningTally = useMemo(() => tallyJerseySizes(jerseyEntries, 'running'), [jerseyEntries]);
  const cyclingTally = useMemo(() => tallyJerseySizes(jerseyEntries, 'cycling'), [jerseyEntries]);
  const runningTotal = runningTally.reduce((sum, item) => sum + item.quantity, 0);
  const cyclingTotal = cyclingTally.reduce((sum, item) => sum + item.quantity, 0);

  const [bills, setBills] = useState<Bill[]>([]);
  const [billsModalVisible, setBillsModalVisible] = useState(false);
  const [billsView, setBillsView] = useState<'active' | 'history'>('active');

  const [createBillModalVisible, setCreateBillModalVisible] = useState(false);
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billName, setBillName] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState<Date>(new Date());
  const [showBillDatePicker, setShowBillDatePicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Map<string, { name: string | null; guestCount: number }>>(new Map());

  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [rsvpsByActivity, setRsvpsByActivity] = useState<Record<string, Rsvp[]>>({});
  const [isSavingRsvp, setIsSavingRsvp] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchHome();
      checkAdminStatus();
      fetchBills();
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
        .select('id, title, description, image_url, location_name, location_url, created_at')
        .eq('is_weekly_activity', false)
        .order('created_at', { ascending: false }),
      supabase.from('weekly_activities').select('id, day, title, time, location_name, location_url'),
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

  async function handleExportJerseyCsv() {
    if (jerseyEntries.length === 0) {
      Alert.alert('Nothing to Export', 'No jersey size submissions yet.');
      return;
    }

    setIsExportingJerseyCsv(true);
    try {
      // expo-sharing is a native module, so it's loaded on demand rather than at
      // import time — that keeps this screen usable on older builds that were
      // compiled before the dependency was added.
      let Sharing: typeof import('expo-sharing');
      try {
        Sharing = require('expo-sharing');
      } catch {
        Alert.alert(
          'Update Required',
          'CSV export needs a newer version of the app. Please install the latest build.'
        );
        return;
      }

      const csv = buildJerseyCsv(jerseyEntries);
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `jersey-sizes-${stamp}.csv`);

      if (file.exists) file.delete();
      file.create();
      file.write(csv);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Not Available', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Jersey Sizes',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not create the CSV file.');
    } finally {
      setIsExportingJerseyCsv(false);
    }
  }

  async function fetchBills() {
    const { data, error } = await supabase
      .from('bills')
      .select('id, created_by, name, description, amount, bill_date, created_at, bill_participants(id, bill_id, email, name, guest_count, has_paid)')
      .order('bill_date', { ascending: false });

    if (!error && data) {
      setBills(
        data.map((b: any) => ({
          id: b.id,
          created_by: b.created_by,
          name: b.name ?? null,
          description: b.description ?? null,
          amount: b.amount,
          bill_date: b.bill_date,
          created_at: b.created_at,
          participants: b.bill_participants || [],
        }))
      );
    }
  }

  function billTotalShares(bill: Bill): number {
    return bill.participants.reduce((sum, p) => sum + 1 + p.guest_count, 0);
  }

  function billIsSettled(bill: Bill): boolean {
    return bill.participants.length > 0 && bill.participants.every((p) => p.has_paid);
  }

  async function toggleParticipantPaid(participant: BillParticipant) {
    const { error } = await supabase
      .from('bill_participants')
      .update({ has_paid: !participant.has_paid, paid_at: !participant.has_paid ? new Date().toISOString() : null })
      .eq('id', participant.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    fetchBills();
  }

  async function openCreateBillModal() {
    setEditingBillId(null);
    setBillName('');
    setBillDescription('');
    setBillAmount('');
    setBillDate(new Date());
    setMemberSearch('');
    setSelectedParticipants(new Map());

    const { data } = await supabase.from('myusers').select('email, name').order('name', { ascending: true });
    setAllMembers((data as Member[]) || []);

    // Creator is always included in the split.
    if (email) {
      const self = (data as Member[] | null)?.find((m) => m.email.toLowerCase() === email.toLowerCase());
      setSelectedParticipants(new Map([[email.toLowerCase(), { name: self?.name || null, guestCount: 0 }]]));
    }

    setCreateBillModalVisible(true);
  }

  async function openEditBillModal(bill: Bill) {
    setEditingBillId(bill.id);
    setBillName(bill.name || '');
    setBillDescription(bill.description || '');
    setBillAmount(String(bill.amount));
    setBillDate(new Date(bill.bill_date));
    setMemberSearch('');

    const { data } = await supabase.from('myusers').select('email, name').order('name', { ascending: true });
    setAllMembers((data as Member[]) || []);

    const map = new Map<string, { name: string | null; guestCount: number }>();
    bill.participants.forEach((p) => {
      map.set(p.email.toLowerCase(), { name: p.name, guestCount: p.guest_count });
    });
    setSelectedParticipants(map);

    setCreateBillModalVisible(true);
  }

  function toggleParticipantSelected(member: Member) {
    setSelectedParticipants((prev) => {
      const next = new Map(prev);
      const key = member.email.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { name: member.name, guestCount: 0 });
      }
      return next;
    });
  }

  function adjustGuestCount(email: string, delta: number) {
    setSelectedParticipants((prev) => {
      const next = new Map(prev);
      const key = email.toLowerCase();
      const current = next.get(key);
      if (!current) return prev;
      next.set(key, { ...current, guestCount: Math.max(0, current.guestCount + delta) });
      return next;
    });
  }

  const onBillDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowBillDatePicker(false);
    if (selectedDate) setBillDate(selectedDate);
  };

  async function handleSaveBill() {
    const trimmedName = billName.trim();
    const trimmedDescription = billDescription.trim();

    if (!trimmedName) {
      Alert.alert('Validation Error', 'Please enter a name for the bill.');
      return;
    }
    const parsedAmount = parseFloat(billAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid bill amount.');
      return;
    }
    if (selectedParticipants.size === 0) {
      Alert.alert('Validation Error', 'Please select at least one participant.');
      return;
    }

    setIsSavingBill(true);
    try {
      let billId = editingBillId;

      if (editingBillId) {
        const { error } = await supabase
          .from('bills')
          .update({
            name: trimmedName,
            description: trimmedDescription || null,
            amount: parsedAmount,
            bill_date: billDate.toISOString().slice(0, 10),
          })
          .eq('id', editingBillId);
        if (error) throw error;

        // Diff against the currently-loaded participants so anyone who already
        // ticked "paid" keeps that status — only membership/guest_count changes apply.
        const existingBill = bills.find((b) => b.id === editingBillId);
        const existingByEmail = new Map((existingBill?.participants || []).map((p) => [p.email.toLowerCase(), p]));

        const toRemove = (existingBill?.participants || []).filter(
          (p) => !selectedParticipants.has(p.email.toLowerCase())
        );
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('bill_participants')
            .delete()
            .in('id', toRemove.map((p) => p.id));
          if (deleteError) throw deleteError;
        }

        for (const [participantEmail, info] of selectedParticipants.entries()) {
          const existing = existingByEmail.get(participantEmail);
          if (existing) {
            if (existing.guest_count !== info.guestCount) {
              const { error: updateError } = await supabase
                .from('bill_participants')
                .update({ guest_count: info.guestCount })
                .eq('id', existing.id);
              if (updateError) throw updateError;
            }
          } else {
            const { error: insertError } = await supabase.from('bill_participants').insert({
              bill_id: billId,
              email: participantEmail,
              name: info.name,
              guest_count: info.guestCount,
            });
            if (insertError) throw insertError;
          }
        }
      } else {
        const { data, error } = await supabase
          .from('bills')
          .insert({
            created_by: email.toLowerCase(),
            name: trimmedName,
            description: trimmedDescription || null,
            amount: parsedAmount,
            bill_date: billDate.toISOString().slice(0, 10),
          })
          .select('id')
          .single();
        if (error) throw error;
        billId = data.id;

        const participantRows = Array.from(selectedParticipants.entries()).map(([participantEmail, info]) => ({
          bill_id: billId,
          email: participantEmail,
          name: info.name,
          guest_count: info.guestCount,
        }));

        const { error: insertError } = await supabase.from('bill_participants').insert(participantRows);
        if (insertError) throw insertError;
      }

      setCreateBillModalVisible(false);
      await fetchBills();
    } catch (err: any) {
      Alert.alert('Error Saving', err.message || 'Could not save bill.');
    } finally {
      setIsSavingBill(false);
    }
  }

  function handleDeleteBill(id: string) {
    Alert.alert('Delete Bill', 'Are you sure you want to delete this bill?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('bills').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchBills();
        },
      },
    ]);
  }

  async function toggleActivityExpand(activityId: string) {
    if (expandedActivityId === activityId) {
      setExpandedActivityId(null);
      return;
    }
    setExpandedActivityId(activityId);

    const { data, error } = await supabase
      .from('activity_rsvps')
      .select('activity_id, email, name, status')
      .eq('activity_id', activityId);

    if (!error && data) {
      setRsvpsByActivity((prev) => ({ ...prev, [activityId]: data as Rsvp[] }));
    }
  }

  async function handleActivityVote(activityId: string, status: Rsvp['status']) {
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
      </View>
    );
  }

  function renderActivity(item: Activity, isLast: boolean) {
    const countdown = formatCountdown(item.day);
    const dayLabel = (item.day || '').slice(0, 3).toUpperCase();
    const isExpanded = expandedActivityId === item.id;
    const rsvps = rsvpsByActivity[item.id] || [];
    const myVote = rsvps.find((r) => r.email.toLowerCase() === email.toLowerCase())?.status;

    return (
      <View key={item.id}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => toggleActivityExpand(item.id)}>
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
        </TouchableOpacity>

        {/* Clickable Location Badge for Direct Maps Navigation */}
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

        <TouchableOpacity
          style={styles.expandToggle}
          onPress={() => toggleActivityExpand(item.id)}
          activeOpacity={0.7}
        >
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
                  onPress={() => handleActivityVote(item.id, option)}
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

        {!isLast && <View style={styles.rowDivider} />}
      </View>
    );
  }

  function renderBill(bill: Bill) {
    const totalShares = billTotalShares(bill);
    const perShare = totalShares > 0 ? bill.amount / totalShares : 0;
    const isCreator = bill.created_by.toLowerCase() === email.toLowerCase();
    const paidCount = bill.participants.filter((p) => p.has_paid).length;

    return (
      <View key={bill.id} style={styles.billCard}>
        <View style={styles.billHeader}>
          <View style={styles.flex1}>
            {/* Named bills lead with the name; older unnamed bills keep the
                amount as the headline so they still read sensibly. */}
            {bill.name ? (
              <>
                <Text style={styles.billName}>{bill.name}</Text>
                <Text style={styles.billAmountWithName}>Rs {bill.amount.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={styles.billAmount}>Rs {bill.amount.toFixed(2)}</Text>
            )}
            <Text style={styles.billDate}>
              {new Date(bill.bill_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            {bill.description ? (
              <Text style={styles.billDescription}>{bill.description}</Text>
            ) : null}
          </View>
          <View style={styles.billProgressPill}>
            <Text style={styles.billProgressText}>
              {paidCount}/{bill.participants.length} paid
            </Text>
          </View>
        </View>

        {bill.participants.map((p) => {
          const owed = perShare * (1 + p.guest_count);
          const isSelf = p.email.toLowerCase() === email.toLowerCase();
          return (
            <View key={p.id} style={styles.billParticipantRow}>
              <TouchableOpacity
                style={styles.billCheckbox}
                onPress={() => isSelf && toggleParticipantPaid(p)}
                disabled={!isSelf}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxBox, p.has_paid && styles.checkboxBoxChecked]}>
                  {p.has_paid && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                </View>
              </TouchableOpacity>
              <View style={styles.flex1}>
                <Text style={styles.billParticipantName}>
                  {p.name || p.email}
                  {p.guest_count > 0 ? ` +${p.guest_count} guest${p.guest_count > 1 ? 's' : ''}` : ''}
                </Text>
              </View>
              <Text style={styles.billParticipantAmount}>Rs {owed.toFixed(2)}</Text>
            </View>
          );
        })}

        {isCreator && (
          <View style={styles.billActionRow}>
            <TouchableOpacity style={styles.billEditBtn} onPress={() => openEditBillModal(bill)}>
              <Text style={styles.billEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.billDeleteBtn} onPress={() => handleDeleteBill(bill.id)}>
              <Text style={styles.billDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
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

            {/* ── Bill Splitting ── */}
            <View style={[styles.sectionSpacing]}>
              <TouchableOpacity
                style={styles.jerseyBlock}
                activeOpacity={0.85}
                onPress={() => setBillsModalVisible(true)}
              >
                <View style={styles.jerseyIconWrap}>
                  <Ionicons name="receipt-outline" size={24} color="#0d9488" />
                </View>
                <View style={styles.jerseyBody}>
                  <Text style={styles.jerseyTitle}>Split a Bill</Text>
                  <Text style={styles.jerseySubtitle}>Float a meal bill and track who's paid</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

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
                  <>
                    <View style={styles.tallyCard}>
                      <Text style={styles.tallySectionTitle}>Cycling Jerseys</Text>
                      <View style={styles.tallyGrid}>
                        {cyclingTally.map(({ size, quantity }) => (
                          <View
                            key={`cycling-${size}`}
                            style={[styles.tallyChip, quantity === 0 && styles.tallyChipEmpty]}
                          >
                            <Text
                              style={[styles.tallyChipSize, quantity === 0 && styles.tallyChipTextEmpty]}
                            >
                              {size}
                            </Text>
                            <Text
                              style={[styles.tallyChipCount, quantity === 0 && styles.tallyChipTextEmpty]}
                            >
                              {quantity}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <Text style={[styles.tallySectionTitle, styles.tallySectionSpacing]}>
                        Running Jerseys
                      </Text>
                      <View style={styles.tallyGrid}>
                        {runningTally.map(({ size, quantity }) => (
                          <View
                            key={`running-${size}`}
                            style={[styles.tallyChip, quantity === 0 && styles.tallyChipEmpty]}
                          >
                            <Text
                              style={[styles.tallyChipSize, quantity === 0 && styles.tallyChipTextEmpty]}
                            >
                              {size}
                            </Text>
                            <Text
                              style={[styles.tallyChipCount, quantity === 0 && styles.tallyChipTextEmpty]}
                            >
                              {quantity}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.tallyTotalsRow}>
                        <Text style={styles.tallyTotalsText}>
                          {cyclingTotal} cycling · {runningTotal} running
                        </Text>
                        <Text style={styles.tallyTotalsText}>
                          {jerseyEntries.length}{' '}
                          {jerseyEntries.length === 1 ? 'member' : 'members'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.csvButton, isExportingJerseyCsv && styles.disabledButton]}
                      onPress={handleExportJerseyCsv}
                      disabled={isExportingJerseyCsv}
                      activeOpacity={0.85}
                    >
                      {isExportingJerseyCsv ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={18} color="#ffffff" />
                          <Text style={styles.csvButtonText}>Download CSV</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {jerseyEntries.map((entry) => (
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
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={billsModalVisible}
        onRequestClose={() => setBillsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Split a Bill</Text>
              <TouchableOpacity onPress={() => setBillsModalVisible(false)}>
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.billTabRow}>
              <TouchableOpacity
                style={[styles.billTab, billsView === 'active' && styles.billTabActive]}
                onPress={() => setBillsView('active')}
              >
                <Text style={[styles.billTabText, billsView === 'active' && styles.billTabTextActive]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.billTab, billsView === 'history' && styles.billTabActive]}
                onPress={() => setBillsView('history')}
              >
                <Text style={[styles.billTabText, billsView === 'history' && styles.billTabTextActive]}>History</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.newBillButton}
              onPress={() => {
                setBillsModalVisible(false);
                openCreateBillModal();
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.newBillButtonText}>New Bill</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(() => {
                const filtered = bills.filter((b) => (billsView === 'active' ? !billIsSettled(b) : billIsSettled(b)));
                if (filtered.length === 0) {
                  return (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        {billsView === 'active' ? 'No active bills.' : 'No settled bills yet.'}
                      </Text>
                    </View>
                  );
                }
                return filtered.map(renderBill);
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={createBillModalVisible}
        onRequestClose={() => setCreateBillModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBillId ? 'Edit Bill' : 'New Bill'}</Text>
              <TouchableOpacity onPress={() => setCreateBillModalVisible(false)}>
                <Text style={styles.closeModalText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Dinner at Kolachi"
                placeholderTextColor="#94a3b8"
                value={billName}
                onChangeText={setBillName}
              />

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any notes about this bill..."
                placeholderTextColor="#94a3b8"
                value={billDescription}
                onChangeText={setBillDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2500"
                placeholderTextColor="#94a3b8"
                value={billAmount}
                onChangeText={setBillAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowBillDatePicker(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={20} color="#0d9488" />
                <Text style={styles.timePickerText}>
                  {billDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {showBillDatePicker && (
                <DateTimePicker value={billDate} mode="date" display="default" onChange={onBillDateChange} />
              )}

              <Text style={[styles.inputLabel, styles.fieldSpacing]}>Participants</Text>
              <TextInput
                style={styles.input}
                placeholder="Search members..."
                placeholderTextColor="#94a3b8"
                value={memberSearch}
                onChangeText={setMemberSearch}
              />

              <View style={styles.memberListBox}>
                {allMembers
                  .filter((m) => {
                    const label = (m.name || m.email).toLowerCase();
                    return label.includes(memberSearch.toLowerCase());
                  })
                  .map((m) => {
                    const key = m.email.toLowerCase();
                    const selected = selectedParticipants.get(key);
                    const isSelected = !!selected;
                    return (
                      <View key={m.email} style={styles.memberRow}>
                        <TouchableOpacity
                          style={styles.memberRowMain}
                          onPress={() => toggleParticipantSelected(m)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxChecked]}>
                            {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                          </View>
                          <Text style={styles.memberRowText} numberOfLines={1}>
                            {m.name || m.email}
                          </Text>
                        </TouchableOpacity>

                        {isSelected && (
                          <View style={styles.guestStepper}>
                            <TouchableOpacity
                              style={styles.guestStepperButton}
                              onPress={() => adjustGuestCount(m.email, -1)}
                            >
                              <Ionicons name="remove" size={14} color="#0d9488" />
                            </TouchableOpacity>
                            <Text style={styles.guestStepperValue}>+{selected.guestCount}</Text>
                            <TouchableOpacity
                              style={styles.guestStepperButton}
                              onPress={() => adjustGuestCount(m.email, 1)}
                            >
                              <Ionicons name="add" size={14} color="#0d9488" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isSavingBill && styles.disabledButton]}
                onPress={handleSaveBill}
                disabled={isSavingBill}
              >
                {isSavingBill ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingBillId ? 'Save Changes' : 'Create Bill'}
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
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488',
  },

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
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
  },
  expandToggleText: { fontSize: 13, fontWeight: '700', color: '#0d9488' },
  rsvpSection: { marginTop: 6 },
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

  // Jersey size totals (admin summary above the per-member list)
  tallyCard: {
    backgroundColor: '#f0fdfa',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  tallySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tallySectionSpacing: { marginTop: 14 },
  tallyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tallyChip: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 58,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  tallyChipEmpty: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  tallyChipSize: { fontSize: 11, fontWeight: '700', color: '#0f766e' },
  tallyChipCount: { fontSize: 18, fontWeight: '800', color: '#0d9488', marginTop: 2 },
  tallyChipTextEmpty: { color: '#cbd5e1' },
  tallyTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccfbf1',
  },
  tallyTotalsText: { fontSize: 12, fontWeight: '700', color: '#0f766e' },

  csvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 14,
  },
  csvButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

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

  // Bill splitting
  flex1: { flex: 1 },
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
  billTabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  billTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  billTabActive: { backgroundColor: '#ffffff' },
  billTabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  billTabTextActive: { color: '#0d9488' },
  newBillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
  },
  newBillButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  billCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  billName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  billAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  billAmountWithName: { fontSize: 15, fontWeight: '700', color: '#0d9488', marginTop: 2 },
  billDescription: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 17 },
  billDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  billProgressPill: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  billProgressText: { fontSize: 12, fontWeight: '700', color: '#0f766e' },
  billParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  billCheckbox: { padding: 2 },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxBoxChecked: { backgroundColor: '#0d9488' },
  billParticipantName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  billParticipantAmount: { fontSize: 14, fontWeight: '700', color: '#0d9488' },
  billActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  billEditBtn: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  billEditText: { color: '#0d9488', fontWeight: '700', fontSize: 12 },
  billDeleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  billDeleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
  memberListBox: {
    maxHeight: 260,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  memberRowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  memberRowText: { fontSize: 14, fontWeight: '600', color: '#0f172a', flexShrink: 1 },
  guestStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guestStepperButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestStepperValue: { fontSize: 13, fontWeight: '700', color: '#0f172a', minWidth: 26, textAlign: 'center' },

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
