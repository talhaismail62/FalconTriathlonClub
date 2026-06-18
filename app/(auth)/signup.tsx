import { Link, useRouter } from 'expo-router';
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
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name || !email || !password) {
      Alert.alert('Missing info', 'Please fill in your name, email and password.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Store the name in user metadata so the profile screen can read it.
      options: { data: { full_name: name } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    // If email confirmation is enabled in Supabase, there is no active session yet.
    if (!data.session) {
      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. Please verify your email, then sign in.'
      );
      router.replace('/(auth)/login');
      return;
    }

    router.replace('/(app)/profile');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Falcon Triathlon Club</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

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

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#1d39c4' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 4, marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  button: {
    backgroundColor: '#1d39c4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#666' },
  link: { color: '#1d39c4', fontWeight: '600' },
});
