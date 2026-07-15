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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

// Required for expo-web-browser redirect handling.
WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Email / password sign-in ──
  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Login failed', error.message);
      return;
    }

    router.replace('/(app)'); // ← Home, not Profile (Defect #2)
  }

  // ── Forgot password (Defect #19) ──
  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email above first, then tap "Forgot password?" again.');
      return;
    }

    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setResetting(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your email', 'We sent you a password reset link.');
    }
  }

  // ── Google OAuth (Defect #17) ──
  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('(app)');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          // Supabase will fire SIGNED_IN via onAuthStateChange.
        }
      }
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={['#ffffff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      {/* ScrollView inside KAV fixes the "screen stops moving up" issue (Defect #12) */}
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/club_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to Falcon Triathlon Club</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {/* Password input with eye toggle (Defect #16) */}
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

          {/* Forgot password (Defect #19) */}
          <TouchableOpacity
            onPress={handleForgotPassword}
            style={styles.forgotBtn}
            disabled={resetting}
          >
            <Text style={styles.forgotText}>
              {resetting ? 'Sending reset link…' : 'Forgot password?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google OAuth (Defect #17) */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#0d9488" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/signup" style={styles.link}>
              Create one now
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
  // Password field with eye icon
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  eyeIcon: { paddingHorizontal: 14 },
  // Forgot password link
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16, paddingVertical: 4 },
  forgotText: { color: '#0d9488', fontSize: 14, fontWeight: '600' },
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
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ccfbf1' },
  dividerText: { marginHorizontal: 12, color: '#64748b', fontWeight: '600', fontSize: 13 },
  // Google button
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
  footerText: { color: '#ffffff' },
  link: { color: '#ffffff', fontWeight: '700', textDecorationLine: 'underline' },
});