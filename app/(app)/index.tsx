import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { CardContainer, GradientButton } from '@/components/UI';

// Define what a post looks like coming from Supabase
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
        {/* Image Section */}
        {item.image_url && (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.postImage} 
            resizeMode="cover" 
          />
        )}
        {/* Text Section */}
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
      <SafeAreaView style={styles.safeArea}>
        {/* Header matching the AppBar style in Flutter's main_screen.dart */}
        <View style={styles.header}>
          <Image 
            source={require('../../assets/images/club_logo.png')} 
            style={styles.logo} 
          />
          <Text style={styles.headerTitle}>Falcon Triathlon</Text>
        </View>

        {/* Feed List */}
        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.feedList}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No club updates yet.</Text>
            }
            ListFooterComponent={
            <View style={styles.footerActions}>
                <GradientButton 
                label="Register for Event" 
                onPress={() => router.push('/(app)/registration')} // <-- ADDED
                />
                <GradientButton 
                label="Buy Merchandise" 
                onPress={() => router.push('/(app)/merchandise')} // <-- ADDED
                />
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0d9488',
  },
  feedList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  postDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 50,
    fontSize: 16,
  },
  footerActions: {
    marginTop: 10,
    marginBottom: 20,
  },
});