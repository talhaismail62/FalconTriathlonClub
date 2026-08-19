import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CardContainer, SCREEN_GRADIENT } from '@/components/UI';

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient 
      colors={[...SCREEN_GRADIENT.colors]}
      locations={[...SCREEN_GRADIENT.locations]}
      start={SCREEN_GRADIENT.start}
      end={SCREEN_GRADIENT.end} 
      style={styles.container}
    >
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 10 }]} edges={['bottom']}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Portal</Text>
          <Text style={styles.headerSubtitle}>System Controls & Management</Text>
        </View>

        <View style={styles.content}>
          {/* Button to Manage Posts */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/manage-posts')}
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

          {/* Button to Manage Activities */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/manage-activities')}
          >
            <CardContainer>
              <View style={styles.cardRow}>
                <View style={styles.iconWrapper}>
                  <Ionicons name="calendar-outline" size={24} color="#0d9488" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Manage Activities</Text>
                  <Text style={styles.cardDesc}>Create, edit, or delete weekly activities</Text>
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
    paddingBottom: 12,
    paddingTop: 0,
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
    marginTop: 4 
  },
  content: { 
    paddingHorizontal: 16, 
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
