import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer } from '@/components/UI';

interface Post {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function HomeTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data as Post[]);
    }
    setLoading(false);
  }

  function renderPost({ item }: { item: Post }) {
    return (
      <CardContainer>
        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />
        )}
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postDescription}>{item.description}</Text>
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
      {/* SafeAreaView ensures content starts below the dynamic header (Defect #14) */}
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.feedList}
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
  feedList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  postTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  postDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 50, fontSize: 16 },
});