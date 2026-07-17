import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const insets = useSafeAreaInsets();

  useEffect(() => { fetchPendingOrders(); }, []);

  async function fetchPendingOrders() {
    const { data } = await supabase
      .from('merchandise_orders')
      .select('*')
      .eq('status', false); // Only get pending orders
      
    setOrders(data || []);
  }

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
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>No pending payments!</Text>}
        renderItem={({ item }) => (
          <CardContainer>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.details}>{item.item_name} - Size: {item.size}</Text>
            <Text style={styles.details}>Rs. {item.price}</Text>
            
            {/* Payment Screenshot */}
            <Image 
              source={{ uri: getPublicUrl(item.payment_screenshot) }} 
              style={styles.screenshot} 
              resizeMode="contain"
            />

            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
              <Text style={styles.approveText}>Approve Payment</Text>
            </TouchableOpacity>
          </CardContainer>
        )}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 50, fontSize: 16 },
  name: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  details: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  screenshot: { width: '100%', height: 200, backgroundColor: '#f1f5f9', borderRadius: 8, marginVertical: 12 },
  approveBtn: { backgroundColor: '#0d9488', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  approveText: { color: '#fff', fontWeight: '700' }
});