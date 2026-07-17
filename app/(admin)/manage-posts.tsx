import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
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
  const insets = useSafeAreaInsets();

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
      // React Native's fetch().blob() uploads a 0-byte file to Supabase storage,
      // so read the file as base64 and decode to an ArrayBuffer instead
      // (same approach as profile.tsx / merchandise.tsx).
      const ext = (imageUri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
      const path = `posts/${Date.now()}.${ext}`;
      const base64 = await new File(imageUri).base64();
      const arrayBuffer = decode(base64);
      const { error } = await supabase.storage
        .from('post_images')
        .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: true }); // Make sure 'post_images' bucket exists
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
      <View style={[styles.form, { paddingTop: insets.top + 16 }]}>
        <TextInput style={styles.input} placeholder="Post Title" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" multiline value={description} onChangeText={setDescription} />
        
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          <Text style={{ color: imageUri ? '#0d9488' : '#94a3b8', fontWeight: '600' }}>
            {imageUri ? "Image Selected ✓" : "Attach Image (Optional)"}
          </Text>
        </TouchableOpacity>

        <GradientButton label={loading ? "Saving..." : "Create Post"} onPress={handleCreate} disabled={loading} />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16, gap: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  imagePicker: { padding: 15, borderWidth: 2, borderColor: '#ccfbf1', borderStyle: 'dashed', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  postImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  postTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteText: { color: '#ef4444', fontWeight: '700', fontSize: 12 }
});