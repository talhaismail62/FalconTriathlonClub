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
// Import the LinearGradient component
import { LinearGradient } from 'expo-linear-gradient';

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
      // Store under both keys: the rest of the app reads `name`, but keep
      // `full_name` for backwards compatibility with anything expecting it.
      options: { data: { full_name: name, name } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

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
    // Replaced the simple View container with the LinearGradient for the diagonal background
    <LinearGradient
      colors={['#fff', '#0d9488']} // White on top-left, Sea Green on bottom-right
      start={{ x: 0.2, y: 0.2 }} // Adjusting start/end points creates the sharp diagonal split
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Falcon Triathlon Club</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#94a3b8" // Slate color for placeholder text
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
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
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
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Adjusted container styles for the new gradient structure
  container: { 
    flex: 1, 
  },
  inner: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 24 
  },
  
  // Typography using Sea Green accents
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: '#0d9488', 
    textAlign: 'center' 
  },
  subtitle: { 
    fontSize: 15, 
    color: '#64748b', 
    marginTop: 4, 
    marginBottom: 32, 
    textAlign: 'center' 
  },
  
  // Inputs with soft sea green borders
  input: {
    borderWidth: 1.5,
    borderColor: '#ccfbf1', 
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff', // Ensures input fields stay clean white
    color: '#0f172a',
  },
  
  // Primary Action Button styled in solid energetic Sea Green
  button: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    // Add depth with a crisp shadow
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonDisabled: { 
    opacity: 0.6,
    shadowOpacity: 0
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 32 
  },
  footerText: { 
    color: '#fff' // Set to white to contrast with the gradient bottom background
  },
  link: { 
    color: '#ffffff', // Ensuring the link text is visible and white
    fontWeight: '700', 
    textDecorationLine: 'underline', // Add underline for emphasis
  },
});