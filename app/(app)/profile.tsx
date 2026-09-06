import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import Avatar from '@/components/Avatar';
import AvatarCropModal from '@/components/AvatarCropModal';
import { CardContainer, SCREEN_GRADIENT } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const GENDER_OPTIONS = ['Male', 'Female'];

const PROFILE_BASE_FIELDS =
  'name, pfp, age, gender, sport_discipline, bio, phone_number, emergency_contact, strava_handle, is_admin';
const PROFILE_EXTENDED_FIELDS = `${PROFILE_BASE_FIELDS}, occupation, city`;

// Single primary sport — stored in `sport_discipline` as one value.
const PRIMARY_SPORT_OPTIONS = ['Cycling', 'Running', 'Swimming'];

const PAKISTAN_CITIES = [
  'Abbottabad',
  'Attock',
  'Bahawalpur',
  'Bannu',
  'Chiniot',
  'Dera Ghazi Khan',
  'Dera Ismail Khan',
  'Faisalabad',
  'Gwadar',
  'Gujranwala',
  'Gujrat',
  'Hyderabad',
  'Islamabad',
  'Jacobabad',
  'Jhelum',
  'Karachi',
  'Kasur',
  'Kohat',
  'Lahore',
  'Larkana',
  'Mardan',
  'Mingora',
  'Mirpur',
  'Multan',
  'Muzaffarabad',
  'Muzaffargarh',
  'Nawabshah',
  'Okara',
  'Peshawar',
  'Quetta',
  'Rahim Yar Khan',
  'Rawalpindi',
  'Sahiwal',
  'Sargodha',
  'Sheikhupura',
  'Sialkot',
  'Sukkur',
  'Swat',
  'Taxila',
].sort((a, b) => a.localeCompare(b));

export default function Profile() {
  const router = useRouter();
  const { session } = useAuth();
  const email = session?.user?.email ?? '';
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [primarySport, setPrimarySport] = useState('');
  const [occupation, setOccupation] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [stravaHandle, setStravaHandle] = useState('');

  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [cropVisible, setCropVisible] = useState(false);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return PAKISTAN_CITIES;
    return PAKISTAN_CITIES.filter((c) => c.toLowerCase().includes(q));
  }, [citySearch]);

  useEffect(() => {
    loadProfile();
  }, [email]);

  async function loadProfile() {
    if (!email) return;

    let { data, error } = await supabase
      .from('myusers')
      .select(PROFILE_EXTENDED_FIELDS)
      .eq('email', email.toLowerCase())
      .single();

    // If occupation/city columns are not migrated yet, fall back so the rest
    // of the profile (including is_admin) still loads.
    if (error) {
      const fallback = await supabase
        .from('myusers')
        .select(PROFILE_BASE_FIELDS)
        .eq('email', email.toLowerCase())
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (data) {
      setFullName(data.name || '');
      setAge(data.age?.toString() || '');
      setGender(data.gender || '');
      // Legacy multi-select values ("Cycling, Running") → take the first sport.
      setPrimarySport((data.sport_discipline || '').split(',')[0]?.trim() || '');
      setOccupation('occupation' in data ? (data.occupation as string) || '' : '');
      setCity('city' in data ? (data.city as string) || '' : '');
      setBio(data.bio || '');
      setPhoneNumber(data.phone_number || '');
      // Legacy rows stored free text here ("Jane 0300..."), so keep only the
      // digits now that this field is numeric.
      setEmergencyContact((data.emergency_contact || '').replace(/[^0-9]/g, ''));
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
    } else if (error) {
      console.error('Profile load error:', error.message);
    }
    setIsLoading(false);
  }

  async function handlePickImage() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'We need camera roll access to update your avatar.');
      return;
    }

    // Skip the system crop UI (black "Crop" chrome is hard to see). We use our own.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0].uri) {
      setCropUri(result.assets[0].uri);
      setCropVisible(true);
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

      const basePayload = {
        name: fullName.trim(),
        pfp: avatarPathForDb,
        age: age ? parseInt(age, 10) : null,
        gender: gender.trim() || null,
        sport_discipline: primarySport.trim() || null,
        bio: bio.trim() || null,
        phone_number: phoneNumber.trim() || null,
        emergency_contact: emergencyContact.trim() || null,
        strava_handle: stravaHandle.trim() || null,
      };

      let { data, error: dbError } = await supabase
        .from('myusers')
        .update({
          ...basePayload,
          occupation: occupation.trim() || null,
          city: city.trim() || null,
        })
        .eq('email', email.toLowerCase())
        .select();

      if (dbError) {
        const retry = await supabase
          .from('myusers')
          .update(basePayload)
          .eq('email', email.toLowerCase())
          .select();
        data = retry.data;
        dbError = retry.error;
      }

      if (dbError) throw dbError;
      if (!data || data.length === 0) throw new Error('Could not find a profile record.');

      await supabase.auth
        .updateUser({
          data: { name: fullName.trim(), pfp: avatarPathForDb },
        })
        .catch(() => {
          /* Silent catch */
        });

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
      <LinearGradient
        colors={[...SCREEN_GRADIENT.colors]}
        locations={[...SCREEN_GRADIENT.locations]}
        start={SCREEN_GRADIENT.start}
        end={SCREEN_GRADIENT.end}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color="#0d9488" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...SCREEN_GRADIENT.colors]}
      locations={[...SCREEN_GRADIENT.locations]}
      start={SCREEN_GRADIENT.start}
      end={SCREEN_GRADIENT.end}
      style={styles.container}
    >
      <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 10 }]} edges={['bottom']}>
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
              <TouchableOpacity
                onPress={isEditing ? handlePickImage : undefined}
                activeOpacity={0.8}
                style={styles.avatarContainer}
              >
                <Avatar url={avatarUri} name={fullName} size={120} />
                {isEditing && (
                  <View style={styles.editBadge}>
                    <Text style={styles.editBadgeText}>CHANGE</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.emailBadge}>{email}</Text>

              {isAdmin && (
                <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/(admin)')}>
                  <Ionicons name="shield-checkmark" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.adminButtonText}>Admin Panel</Text>
                </TouchableOpacity>
              )}

              {isEditing ? (
                <View style={styles.formCard}>
                  <Text style={styles.label}>Athlete Name</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter full name"
                    placeholderTextColor="#94a3b8"
                  />

                  <View style={styles.row}>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Age</Text>
                      <TextInput
                        style={styles.input}
                        value={age}
                        onChangeText={setAge}
                        placeholder="Age"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.label}>Gender</Text>
                      <View style={styles.optionRow}>
                        {GENDER_OPTIONS.map((option) => {
                          const selected = gender === option;
                          return (
                            <TouchableOpacity
                              key={option}
                              style={[styles.optionChip, selected && styles.optionChipActive]}
                              onPress={() => setGender(option)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <Text style={styles.label}>Primary Sport</Text>
                  <Text style={styles.helperText}>Choose one</Text>
                  <View style={styles.optionRow}>
                    {PRIMARY_SPORT_OPTIONS.map((option) => {
                      const selected = primarySport === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, selected && styles.optionChipActive]}
                          onPress={() => setPrimarySport(option)}
                          activeOpacity={0.8}
                        >
                          {selected && (
                            <Ionicons name="checkmark" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                          )}
                          <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Occupation</Text>
                  <TextInput
                    style={styles.input}
                    value={occupation}
                    onChangeText={setOccupation}
                    placeholder="e.g. Software Engineer"
                    placeholderTextColor="#94a3b8"
                  />

                  <Text style={styles.label}>City</Text>
                  <TouchableOpacity
                    style={styles.cityPicker}
                    onPress={() => {
                      setCitySearch('');
                      setCityModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cityPickerText, !city && styles.cityPickerPlaceholder]}>
                      {city || 'Select a city in Pakistan'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#64748b" />
                  </TouchableOpacity>

                  <Text style={styles.label}>Bio</Text>
                  <TextInput
                    style={[styles.input, { height: 80 }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Short bio"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />

                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Phone number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.label}>Emergency Contact</Text>
                  <TextInput
                    style={styles.input}
                    value={emergencyContact}
                    onChangeText={(text) => setEmergencyContact(text.replace(/[^0-9]/g, ''))}
                    placeholder="Emergency contact number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                  />

                  <Text style={styles.label}>Strava Handle</Text>
                  <TextInput
                    style={styles.input}
                    value={stravaHandle}
                    onChangeText={setStravaHandle}
                    placeholder="Strava profile link/handle"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.saveButton, isUpdating && styles.disabledButton]}
                    onPress={handleSaveProfile}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>

                  {fullName !== '' && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setIsEditing(false)}
                      disabled={isUpdating}
                    >
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

                    <Text style={styles.viewLabel}>Primary Sport</Text>
                    <Text style={styles.viewValue}>{primarySport || 'Not set'}</Text>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>Occupation</Text>
                    <Text style={styles.viewValue}>{occupation || 'Not set'}</Text>
                    <View style={styles.divider} />

                    <Text style={styles.viewLabel}>City</Text>
                    <Text style={styles.viewValue}>{city || 'Not set'}</Text>
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={cityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.cityModalOverlay}>
          <View style={styles.cityModalSheet}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.citySearchInput}
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Search cities..."
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
            />
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = city === item;
                return (
                  <TouchableOpacity
                    style={[styles.cityRow, selected && styles.cityRowSelected]}
                    onPress={() => {
                      setCity(item);
                      setCityModalVisible(false);
                    }}
                  >
                    <Text style={[styles.cityRowText, selected && styles.cityRowTextSelected]}>
                      {item}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#0d9488" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.cityEmptyText}>No cities match your search.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      <AvatarCropModal
        visible={cropVisible}
        imageUri={cropUri}
        onCancel={() => {
          setCropVisible(false);
          setCropUri(null);
        }}
        onDone={(uri) => {
          setAvatarUri(uri);
          setCropVisible(false);
          setCropUri(null);
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardContainer: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  editPillText: { color: '#0d9488', fontWeight: '700', fontSize: 13 },
  inner: { paddingHorizontal: 16, paddingBottom: 40, alignItems: 'center' },
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
  editBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  emailBadge: {
    fontSize: 14,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    fontWeight: '500',
  },
  adminButton: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 24,
    alignItems: 'center',
  },
  adminButtonText: { color: '#ffffff', fontWeight: '700' },
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
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
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
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: -2, marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  optionChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  optionChipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  optionChipTextActive: { color: '#ffffff' },
  cityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  cityPickerText: { fontSize: 16, color: '#0f172a', flex: 1, marginRight: 8 },
  cityPickerPlaceholder: { color: '#94a3b8' },
  saveButton: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  cancelButton: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: '#64748b', fontWeight: '600' },
  viewContainer: { width: '100%', marginBottom: 24 },
  viewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewValue: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  signOutButton: {
    borderWidth: 1.5,
    borderColor: '#fee2e2',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  signOutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  cityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  cityModalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  cityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cityModalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  citySearchInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cityRowSelected: { backgroundColor: '#f0fdfa' },
  cityRowText: { fontSize: 16, color: '#0f172a', fontWeight: '500' },
  cityRowTextSelected: { color: '#0d9488', fontWeight: '700' },
  cityEmptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    paddingVertical: 24,
    fontSize: 14,
  },
});
