import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CardContainer } from '@/components/UI';
import { SafeAreaView } from 'react-native-safe-area-context'; // <-- Import this

export default function AdminDashboard() {
  return (
    <LinearGradient 
      colors={['#ffffff', '#0d9488']} 
      start={{ x: 0.2, y: 0.2 }} 
      end={{ x: 0.8, y: 0.8 }} 
      style={styles.container}
    >
      {/* Added SafeAreaView with edges={['top']} to push content below the header */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <CardContainer>
            <TouchableOpacity 
              style={styles.adminCard} 
              onPress={() => router.push('/(admin)/manage-posts')}
            >
              <Text style={styles.cardTitle}>Manage Posts</Text>
              <Text style={styles.cardSubtext}>Create, edit, or delete home feed posts.</Text>
            </TouchableOpacity>
          </CardContainer>

          <CardContainer>
            <TouchableOpacity 
              style={styles.adminCard} 
              onPress={() => router.push('/(admin)/verify-payments')}
            >
              <Text style={styles.cardTitle}>Verify Payments</Text>
              <Text style={styles.cardSubtext}>Approve or reject merchandise payment proofs.</Text>
            </TouchableOpacity>
          </CardContainer>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 }, // <-- Added
  content: { 
    flex: 1, 
    justifyContent: 'center',
    padding: 16 
  },
  adminCard: { padding: 10 },
  icon: { fontSize: 32, marginBottom: 10 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardSubtext: { fontSize: 14, color: '#64748b' },
});