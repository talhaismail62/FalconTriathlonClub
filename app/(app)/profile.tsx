import { useRouter } from 'expo-router';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();

  const fullName = (session?.user?.user_metadata?.full_name as string) ?? 'Athlete';
  const email = session?.user?.email ?? '';

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Avatar name={fullName} size={120} />

        <Text style={styles.name}>{fullName}</Text>
        {!!email && <Text style={styles.email}>{email}</Text>}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  name: { fontSize: 24, fontWeight: '700', color: '#222', marginTop: 20 },
  email: { fontSize: 15, color: '#666', marginTop: 4 },
  signOutButton: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#ff4d4f',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  signOutText: { color: '#ff4d4f', fontSize: 16, fontWeight: '600' },
});
