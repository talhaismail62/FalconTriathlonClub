import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardContainer, GradientButton } from '@/components/UI';

interface Post { id: string; title: string; description: string; image_url: string | null; }

export default function ManagePosts() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function handleCreate() {
    if (!title.trim()) return Alert.alert("Error", "Title is required");
    setLoading(true);
    let imageUrl = null;

    if (imageUri && session?.user) {
      const blob = await (await fetch(imageUri)).blob();
      const ext = imageUri.split('.').pop();
      const path = `posts/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('post_images').upload(path, blob);
      if (!error) {
        const { data: publicUrlData } = supabase.storage.from('post_images').getPublicUrl(path);
        imageUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase.from('posts').insert({ title, description, image_url: imageUrl });
    if (error) Alert.alert("Error", error.message);
    else {
      setTitle(''); setDescription(''); setImageUri(null);
      fetchPosts();
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    Alert.alert("Delete Post", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from('posts').delete().eq('id', id);
        fetchPosts();
      }}
    ]);
  }

  return (
    <LinearGradient colors={['#ffffff', '#0d9488']} start={{ x: 0.2, y: 0.2 }} end={{ x: 0.8, y: 0.8 }} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Post Title" value={title} onChangeText={setTitle} />
          <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" multiline value={description} onChangeText={setDescription} />
          
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            <Text style={{ color: imageUri ? '#0d9488' : '#94a3b8', fontWeight: '600' }}>
              {imageUri ? "Image Selected ✓" : "Attach Image (Optional)"}
            </Text>
          </TouchableOpacity>

          <GradientButton label={loading ? "Saving..." : "Create Post"} onPress={handleCreate} />
        </View>

        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <CardContainer>
              {item.image_url && <Image source={{ uri: item.image_url }} style={styles.postImage} />}
              <Text style={styles.postTitle}>{item.title}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </CardContainer>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, // Removed marginTop: 90
  form: { padding: 16, gap: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  imagePicker: { padding: 15, borderWidth: 2, borderColor: '#ccfbf1', borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  postImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 }
});