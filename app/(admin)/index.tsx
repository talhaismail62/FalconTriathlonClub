import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CardContainer } from '@/components/UI';

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient 
      colors={['#ffffff', '#0d9488']} 
      start={{ x: 0.2, y: 0.2 }} 
      end={{ x: 0.8, y: 0.8 }} 
      style={styles.container}
    >
      {/* 
        edges={['bottom']} ensures it doesn't double-pad the top, 
        since the Stack header in _layout.tsx is now solid and handles the top safe area.
      */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Portal</Text>
          <Text style={styles.headerSubtitle}>System Controls & Management</Text>
        </View>

        <View style={styles.content}>
          {/* Button to Manage Posts */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/manage-posts')}
            style={styles.touchableMargin}
          >
            <CardContainer>
              <View style={styles.cardRow}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="document-text-outline" size={24} color="#0d9488" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Manage Posts</Text>
                  <Text style={styles.cardDesc}>Create, update, or delete club updates</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </View>
            </CardContainer>
          </TouchableOpacity>

          {/* Button to Verify Payments */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/verify-payments')}
            style={styles.touchableMargin}
          >
            <CardContainer>
              <View style={styles.cardRow}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="card-outline" size={24} color="#0d9488" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Verify Payments</Text>
                  <Text style={styles.cardDesc}>Approve pending user transactions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </View>
            </CardContainer>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  safeArea: { 
    flex: 1 
  },
  header: { 
    paddingHorizontal: 16, 
    paddingBottom: 20,
    paddingTop: 10, // Added a tiny bit of top padding since header is handled by layout
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#0f172a' 
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#64748b', 
    fontWeight: '500', 
    marginTop: 2 
  },
  content: { 
    paddingHorizontal: 16, 
  },
  touchableMargin: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f0fdfa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
});