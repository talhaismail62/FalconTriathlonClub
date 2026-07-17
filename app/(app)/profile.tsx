import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
// Industry Practice: Use the modern File interface from expo-file-system
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();

  // Component local states
  const initialName =
    (session?.user?.user_metadata?.name as string) ??
    (session?.user?.user_metadata?.full_name as string) ??
    'Athlete';
  const email = session?.user?.email ?? '';

  const [fullName, setFullName] = useState(initialName);
  const [avatarUri, setAvatarUri] = useState<string | null>(
    session?.user?.user_metadata?.pfp ?? null // Aligned to 'pfp'
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Industry Best Practice: Native Permission Checking and Storage Pipeline
  async function handlePickImage() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'We need camera roll access to update your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6, // Compressed for mobile asset efficiency
    });

    if (!result.canceled && result.assets[0].uri) {
      const selectedUri = result.assets[0].uri;
      setAvatarUri(selectedUri);
      await handleSaveProfile(fullName, selectedUri);
    }
  }

  // Blends metadata updates cleanly into your custom 'myusers' table
  async function handleSaveProfile(newName: string, currentAvatar: string | null) {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'Profile name cannot be left blank.');
      return;
    }

    setIsUpdating(true);
    
    try {
      let finalAvatarUrl = currentAvatar;

      // Safe Native Upload via modern expo-file-system File API
      if (currentAvatar && currentAvatar.startsWith('file://')) {
        const fileExt = currentAvatar.split('.').pop()?.toLowerCase() ?? 'jpg';
        const fileName = `${session?.user?.id}/${Date.now()}.${fileExt}`;

        // Uses modern class constructor to read base64 safely without deprecation errors
        const fileInstance = new File(currentAvatar);
        const base64 = await fileInstance.base64();
        const arrayBuffer = decode(base64);

        // Upload to your explicit 'profile_pics' storage bucket
        const { error: uploadError } = await supabase.storage
          .from('profile_pics')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Extract clean public URL string
        const { data: urlData } = supabase.storage
          .from('profile_pics')
          .getPublicUrl(fileName);

        finalAvatarUrl = urlData.publicUrl;
      }

      // MODIFIED: Direct custom table update matching your active email-based RLS permissions
      const { data, error: dbError } = await supabase
        .from('myusers')
        .update({
          name: newName.trim(),
          pfp: finalAvatarUrl
        })
        .eq('email', email.trim().toLowerCase())
        .select();

      if (dbError) throw dbError;

      // Guard check to make sure a row was actually found and modified
      if (!data || data.length === 0) {
        throw new Error("Could not find a profile record matching your authenticated email address.");
      }

      // Sync fallback metadata quietly in the background
      await supabase.auth.updateUser({
        data: { 
          name: newName.trim(),
          pfp: finalAvatarUrl 
        },
      }).catch(() => { /* Silent catch to handle minor metadata exceptions cleanly */ });

      Alert.alert('Success', 'Your athlete profile details have been saved.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'An internal database error occurred.');
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleSignOut() {
    setIsLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setIsLoggingOut(false);

    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/(auth)/login');
  }

  return (
    <LinearGradient
      colors={['#ffffff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.inner}>
            
            {/* AVATAR INTERACTIVE PORTAL */}
            <TouchableOpacity 
              onPress={handlePickImage} 
              activeOpacity={0.8} 
              style={styles.avatarContainer}
            >
              <Avatar url={avatarUri} name={fullName} size={120} />
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>EDIT</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onLongPress={() => router.push('/(admin)')} // Long press your email to open admin!
              activeOpacity={0.7}
            >
              <Text style={styles.emailBadge}>{email}</Text>
            </TouchableOpacity>

            {/* EDITABLE FORM CONTAINER */}
            <View style={styles.formCard}>
              <Text style={styles.label}>Athlete Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
              />

              <TouchableOpacity 
                style={[styles.saveButton, isUpdating && styles.disabledButton]} 
                onPress={() => handleSaveProfile(fullName, avatarUri)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* DESTRUCTIVE ACTION ROW */}
            <TouchableOpacity 
              style={[styles.signOutButton, isLoggingOut && styles.disabledButton]} 
              onPress={handleSignOut}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <Text style={styles.signOutText}>Sign Out Account</Text>
              )}
            </TouchableOpacity>
            
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  keyboardContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  inner: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24 
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0d9488',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  editBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  emailBadge: { 
    fontSize: 14, 
    color: '#475569', 
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 28,
    fontWeight: '500',
  },
  formCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0', 
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  saveButton: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  signOutButton: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#fee2e2',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  signOutText: { 
    color: '#ef4444', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  disabledButton: {
    opacity: 0.5,
  }
});