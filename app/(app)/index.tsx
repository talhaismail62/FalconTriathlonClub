<<<<<<< HEAD
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';
=======
import { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
>>>>>>> AAB

interface Post {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
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

export default function HomeTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [])
  );

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, description, image_url, created_at')
      .eq('is_weekly_activity', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data as Post[]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  function renderPost({ item }: { item: Post }) {
    const imageUrl = item.image_url 
      ? supabase.storage.from('post_images').getPublicUrl(item.image_url).data.publicUrl
      : null;

    return (
      <CardContainer>
<<<<<<< HEAD
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        )}
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postDescription}>{item.description}</Text>
=======
        {imageUrl && (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.postImage} 
            resizeMode="cover" 
          />
        )}
        <View style={styles.postTextContainer}>
          <Text style={styles.postTitle}>{item.title}</Text>
          
          {/* Friendly Timestamp Metadata Row */}
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color="#94a3b8" />
            <Text style={styles.timeText}>{formatPostTime(item.created_at)}</Text>
          </View>

          <Text style={styles.postDescription}>{item.description}</Text>
        </View>
>>>>>>> AAB
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
<<<<<<< HEAD
      {/* SafeAreaView ensures content starts below the dynamic header (Defect #14) */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
=======
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 10 }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Falcon Triathlon</Text>
        </View>

>>>>>>> AAB
        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.feedList}
<<<<<<< HEAD
=======
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />
            }
>>>>>>> AAB
            ListEmptyComponent={<Text style={styles.emptyText}>No club updates yet.</Text>}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
<<<<<<< HEAD
  feedList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  postTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
=======
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  feedList: { paddingHorizontal: 16, paddingBottom: 110 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  postTextContainer: { paddingHorizontal: 4 },
  postTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 8 },
  timeText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
>>>>>>> AAB
  postDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 50, fontSize: 16 },
});