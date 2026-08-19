import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { SCREEN_GRADIENT } from '@/components/UI';

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Email / password sign-up ──
  async function handleSignup() {
    if (!name || !email || !password) {
      Alert.alert('Missing info', 'Please fill in your name, email and password.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setLoading(false);
      Alert.alert('Sign up failed', error.message);
      return;
    }

    // Store auth_uid in the myusers table (Defect #3)
    if (data.user) {
      const emailLower = email.trim().toLowerCase();
      
      // 1. Check if a row already exists (e.g., created by a database trigger)
      const { data: existingUser } = await supabase
        .from('myusers')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();

      if (existingUser) {
        // 2. If it exists, update it with the auth_uid
        const { error: updateError } = await supabase
          .from('myusers')
          .update({ auth_uid: data.user.id, name: name.trim() })
          .eq('email', emailLower);
          
        if (updateError) console.warn('[signup] myusers update failed:', updateError.message);
      } else {
        // 3. If it doesn't exist, insert it
        const { error: insertError } = await supabase
          .from('myusers')
          .insert({ auth_uid: data.user.id, email: emailLower, name: name.trim() });
          
        if (insertError) console.warn('[signup] myusers insert failed:', insertError.message);
      }
    }

    setLoading(false);

    if (!data.session) {
      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. Please verify your email, then sign in.'
      );
      router.replace('/(auth)/login');
      return;
    }

    router.replace('/(app)'); // ← Home, not Profile (Defect #2)
  }

  // ── Google OAuth (Defect #17) ──
  // Flow lives in lib/googleAuth so login and signup can't drift apart. The
  // myusers row is now created by a database trigger on auth.users, so this
  // path no longer needs to provision it manually.
  async function handleGoogleSignIn() {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);

    // On success AuthContext redirects; a cancel is silent. Only real errors alert.
    if (!result.ok && result.reason === 'error') {
      Alert.alert('Google sign-in failed', result.message ?? 'Unknown error');
    }
  }

  return (
    <LinearGradient
      colors={[...SCREEN_GRADIENT.colors]}
      locations={[...SCREEN_GRADIENT.locations]}
      start={SCREEN_GRADIENT.start}
      end={SCREEN_GRADIENT.end}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            paddingTop: 60, // Pushes content down from the top
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* FTC logo at the top of Sign Up (Defect #22) */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/club_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Falcon Triathlon Club</Text>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {/* Password with eye toggle (Defect #16) */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#0d9488" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 40,
  },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 120, height: 120, backgroundColor: '#ffffff', borderRadius: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#0d9488', textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 28,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  eyeIcon: { paddingHorizontal: 14 },
  button: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.6, shadowOpacity: 0 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ccfbf1' },
  dividerText: { marginHorizontal: 12, color: '#64748b', fontWeight: '600', fontSize: 13 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
  },
  googleButtonText: { color: '#0d9488', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#fff' },
  link: { color: '#ffffff', fontWeight: '700', textDecorationLine: 'underline' },
});