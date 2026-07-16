import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';

interface Order { 
  id: string; 
  full_name: string; 
  item_name: string; 
  size: string; 
  price: number; 
  payment_screenshot: string; 
}

export default function VerifyPayments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => { fetchPendingOrders(); }, []);

  async function fetchPendingOrders() {
    const { data } = await supabase
      .from('merchandise_orders')
      .select('*')
      .eq('status', false); // Only get pending orders
      
    setOrders(data || []);
    setRefreshing(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingOrders();
  };

  async function handleApprove(id: string) {
    Alert.alert("Approve", "Mark this payment as verified?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: async () => {
        await supabase.from('merchandise_orders').update({ status: true }).eq('id', id);
        fetchPendingOrders(); // Refresh list
      }}
    ]);
  }

  function getPublicUrl(path: string) {
    const { data } = supabase.storage.from('payment_proofs').getPublicUrl(path);
    return data.publicUrl;
  }

  return (
    <LinearGradient colors={['#ffffff', '#0d9488']} start={{ x: 0.2, y: 0.2 }} end={{ x: 0.8, y: 0.8 }} style={styles.container}>
      {/* Safe Area Layout Wrapper providing unified spacing */}
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 5 }]} edges={['top']}>
        
        {/* Consistent Bold Black Top Heading */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verify Payments</Text>
          <Text style={styles.headerSubtitle}>Confirm customer screenshot transfers</Text>
        </View>

        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>All payments verified. Clear queue!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <CardContainer>
              <Text style={styles.name}>{item.full_name}</Text>
              
              <View style={styles.detailsRow}>
                <Ionicons name="shirt-outline" size={14} color="#64748b" />
                <Text style={styles.details}>{item.item_name} — Size: {item.size}</Text>
              </View>

              <View style={styles.detailsRow}>
                <Ionicons name="cash-outline" size={14} color="#0d9488" />
                <Text style={[styles.details, styles.priceText]}>Rs. {item.price}</Text>
              </View>
              
              {/* Payment Screenshot Proof */}
              <Text style={styles.screenshotLabel}>Receipt Attachment:</Text>
              <Image 
                source={{ uri: getPublicUrl(item.payment_screenshot) }} 
                style={styles.screenshot} 
                resizeMode="contain"
              />

              <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
                <Ionicons name="checkmark-done" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.approveText}>Approve Payment</Text>
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
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 2 },
  
  name: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  details: { fontSize: 14, color: '#475569', fontWeight: '500' },
  priceText: { color: '#0d9488', fontWeight: '700' },
  
  screenshotLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: 10 },
  screenshot: { width: '100%', height: 260, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4, marginBottom: 12 },
  
  approveBtn: { flexDirection: 'row', backgroundColor: '#0d9488', paddingVertical: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 8 },
  emptyText: { textAlign: 'center', color: '#64748b', fontSize: 16, fontWeight: '600' }
});