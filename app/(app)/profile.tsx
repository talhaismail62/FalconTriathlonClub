import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import Avatar from '@/components/Avatar';
import { CardContainer } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();
  const email = session?.user?.email ?? '';

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [sportDiscipline, setSportDiscipline] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [stravaHandle, setStravaHandle] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [email]);

  async function loadProfile() {
    if (!email) return;
    const { data, error } = await supabase
      .from('myusers')
      .select('name, pfp, age, gender, sport_discipline, bio, phone_number, emergency_contact, strava_handle, is_admin')
      .eq('email', email.toLowerCase())
      .single();

    if (data) {
      setFullName(data.name || '');
      setAge(data.age?.toString() || '');
      setGender(data.gender || '');
      setSportDiscipline(data.sport_discipline || '');
      setBio(data.bio || '');
      setPhoneNumber(data.phone_number || '');
      setEmergencyContact(data.emergency_contact || '');
      setStravaHandle(data.strava_handle || '');
      setIsAdmin(data.is_admin || false);

      // Generate a 10-year Signed URL for the private bucket
      if (data.pfp) {
        const { data: urlData } = await supabase.storage
          .from('profile_pics')
          .createSignedUrl(data.pfp, 315360000); // 10 years in seconds
        if (urlData?.signedUrl) setAvatarUri(urlData.signedUrl);
      } else {
        setAvatarUri(null);
      }

      if (!data.name || !data.sport_discipline || !data.phone_number) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    }
    setIsLoading(false);
  }

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
      quality: 0.4, 
    });

    if (!result.canceled && result.assets[0].uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function handleSaveProfile() {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Profile name cannot be left blank.');
      return;
    }

    setIsUpdating(true);
    try {
      let avatarPathForDb = null;

      if (avatarUri && avatarUri.startsWith('file://')) {
        const fileExt = 'jpg';
        const fileName = `${session?.user?.id}/avatar.${fileExt}`;

        const fileInstance = new File(avatarUri);
        const base64 = await fileInstance.base64();
        const arrayBuffer = decode(base64);

        const { error: uploadError } = await supabase.storage
          .from('profile_pics')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        avatarPathForDb = fileName;

        // Generate Signed URL for immediate local UI update
        const { data: urlData } = await supabase.storage
          .from('profile_pics')
          .createSignedUrl(fileName, 315360000);
        if (urlData?.signedUrl) setAvatarUri(urlData.signedUrl);
      } else if (avatarUri) {
        try {
            const url = new URL(avatarUri);
            const pathIndex = url.pathname.indexOf('/profile_pics/') + '/profile_pics/'.length;
            avatarPathForDb = url.pathname.substring(pathIndex).split('?')[0];
        } catch (e) {
            avatarPathForDb = avatarUri;
        }
      }

      const { data, error: dbError } = await supabase
        .from('myusers')
        .update({
          name: fullName.trim(),
          pfp: avatarPathForDb, 
          age: age ? parseInt(age, 10) : null,
          gender: gender.trim() || null,
          sport_discipline: sportDiscipline.trim() || null,
          bio: bio.trim() || null,
          phone_number: phoneNumber.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          strava_handle: stravaHandle.trim() || null,
        })
        .eq('email', email.toLowerCase())
        .select();

      if (dbError) throw dbError;
      if (!data || data.length === 0) throw new Error("Could not find a profile record.");

      await supabase.auth.updateUser({
        data: { name: fullName.trim(), pfp: avatarPathForDb },
      }).catch(() => { /* Silent catch */ });

      Alert.alert('Success', 'Your athlete profile details have been saved.');
      setIsEditing(false);
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

  if (isLoading) {
    return (
      <LinearGradient colors={['#ffffff', '#0d9488']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </LinearGradient>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <Text style={styles.screenTitle}>{isEditing ? 'Edit Profile' : 'My Profile'}</Text>
              {!isEditing && (
                <TouchableOpacity style={styles.editPill} onPress={() => setIsEditing(true)}>
                  <Ionicons name="pencil" size={14} color="#0d9488" />
                  <Text style={styles.editPillText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inner}>
              <TouchableOpacity onPress={isEditing ? handlePickImage : undefined} activeOpacity={0.8} style={styles.avatarContainer}>
                <Avatar url={avatarUri} name={fullName} size={120} />
                {isEditing && (
                  <View style={styles.editBadge}>
                    <Text style={styles.editBadgeText}>CHANGE</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.emailBadge}>{email}</Text>


              {/* Find this section in your Profile.tsx and replace it: */}
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.adminButton} 
                  onPress={() => router.push('/(admin)')} // <-- EXPLICIT index path instead of /(admin)
                >
                  <Ionicons name="shield-checkmark" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.adminButtonText}>Admin Panel</Text>
                </TouchableOpacity>
              )}

              {isEditing ? (
                <View style={styles.formCard}>
                  <Text style={styles.label}>Athlete Name</Text>
                  <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Enter full name" placeholderTextColor="#94a3b8" />

                  <View style={styles.row}>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Age</Text>
                      <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Age" placeholderTextColor="#94a3b8" keyboardType="numeric" />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Gender</Text>
                      <TextInput style={styles.input} value={gender} onChangeText={setGender} placeholder="Male/Female/Other" placeholderTextColor="#94a3b8" />
                    </View>
                  </View>

                  <Text style={styles.label}>Sport Discipline</Text>
                  <TextInput style={styles.input} value={sportDiscipline} onChangeText={setSportDiscipline} placeholder="e.g., Triathlon, Cycling" placeholderTextColor="#94a3b8" />

                  <Text style={styles.label}>Bio</Text>
                  <TextInput style={[styles.input, { height: 80 }]} value={bio} onChangeText={setBio} placeholder="Short bio" placeholderTextColor="#94a3b8" multiline />

                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Phone number" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />

                  <Text style={styles.label}>Emergency Contact</Text>
                  <TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Name & Phone" placeholderTextColor="#94a3b8" />

                  <Text style={styles.label}>Strava Handle</Text>
                  <TextInput style={styles.input} value={stravaHandle} onChangeText={setStravaHandle} placeholder="Strava profile link/handle" placeholderTextColor="#94a3b8" autoCapitalize="none" />

                  <TouchableOpacity style={[styles.saveButton, isUpdating && styles.disabledButton]} onPress={handleSaveProfile} disabled={isUpdating}>
                    {isUpdating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                  </TouchableOpacity>

                  {fullName !== '' && (
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)} disabled={isUpdating}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.viewContainer}>
                  <CardContainer>
                    <Text style={styles.viewLabel}>Athlete Name</Text>
                    <Text style={styles.viewValue}>{fullName || 'Not set'}</Text>
                    <View style={styles.divider} />

                    <View style={styles.row}>
                      <View style={styles.flex1}>
                        <Text style={styles.viewLabel}>Age</Text>
                        <Text style={styles.viewValue}>{age || 'Not set'}</Text>
                      </View>
                      <View style={styles.flex1}>
                        <Text style={styles.viewLabel}>Gender</Text>
                        <Text style={styles.viewValue}>{gender || 'Not set'}</Text>
                      </View>
                    </View>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>Sport Discipline</Text>
                    <Text style={styles.viewValue}>{sportDiscipline || 'Not set'}</Text>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>Bio</Text>
                    <Text style={styles.viewValue}>{bio || 'No bio added yet.'}</Text>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>Phone Number</Text>
                    <Text style={styles.viewValue}>{phoneNumber || 'Not set'}</Text>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>Emergency Contact</Text>
                    <Text style={styles.viewValue}>{emergencyContact || 'Not set'}</Text>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>Strava Handle</Text>
                    <Text style={styles.viewValue}>{stravaHandle || 'Not linked'}</Text>
                  </CardContainer>
                </View>
              )}

              <TouchableOpacity style={[styles.signOutButton, isLoggingOut && styles.disabledButton]} onPress={handleSignOut} disabled={isLoggingOut}>
                {isLoggingOut ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.signOutText}>Sign Out Account</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardContainer: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 50, paddingBottom: 10 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  editPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ccfbf1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  editPillText: { color: '#0d9488', fontWeight: '700', fontSize: 13 },
  inner: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
  avatarContainer: { position: 'relative', marginBottom: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0d9488', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#ffffff' },
  editBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  emailBadge: { fontSize: 14, color: '#475569', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, overflow: 'hidden', marginBottom: 16, fontWeight: '500' },
  adminButton: { flexDirection: 'row', backgroundColor: '#0f172a', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, marginBottom: 24, alignItems: 'center' },
  adminButtonText: { color: '#ffffff', fontWeight: '700' },
  formCard: { width: '100%', backgroundColor: '#ffffff', padding: 20, borderRadius: 16, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, marginBottom: 16, backgroundColor: '#f8fafc', color: '#0f172a' },
  saveButton: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  cancelButton: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: '#64748b', fontWeight: '600' },
  viewContainer: { width: '100%', marginBottom: 24 },
  viewLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  viewValue: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  signOutButton: { borderWidth: 1.5, borderColor: '#fee2e2', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center', marginTop: 16 },
  signOutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
});