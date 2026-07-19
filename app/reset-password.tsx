import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Completes the "forgot password" flow.
 *
 * Deliberately lives OUTSIDE the (auth) group: opening a recovery link signs the
 * user in with a temporary session, and (auth)/_layout redirects any session
 * straight to /(app) — which would bounce the user off this screen before they
 * could set a password.
 */
export default function ResetPassword() {
  const router = useRouter();
  const { endRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // A recovery link establishes a session before this screen mounts. Without one
  // there is nothing to update, so tell the user instead of failing silently.
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasRecoverySession(!!data.session);
    });

    // The session may land moments after mount, while Supabase parses the link.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setHasRecoverySession(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Password too short',
        `Please use at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password in both fields.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }

    // Sign out so the temporary recovery session can't be mistaken for a normal
    // login, then send the user back to log in with their new password.
    endRecovery();
    await supabase.auth.signOut();
    Alert.alert('Password updated', 'You can now log in with your new password.');
    router.replace('/(auth)/login');
  }

  if (hasRecoverySession === null) {
    return (
      <LinearGradient colors={['#ffffff', '#0d9488']} style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </LinearGradient>
    );
  }

  if (!hasRecoverySession) {
    return (
      <LinearGradient
        colors={['#ffffff', '#0d9488']}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={styles.centered}
      >
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Reset link expired</Text>
        <Text style={styles.errorText}>
          This password reset link is invalid or has already been used. Request a new one from the
          login screen.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            endRecovery();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={styles.buttonText}>Back to login</Text>
        </TouchableOpacity>
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
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Choose a password you haven&apos;t used before.</Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword((prev) => !prev)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#0d9488"
              />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Update password</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 40,
  },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  errorText: { fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 21 },
});
