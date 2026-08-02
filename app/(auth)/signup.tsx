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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      options: { data: { full_name: name } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data.user) {
      const emailLower = email.trim().toLowerCase();
      
      const { data: existingUser } = await supabase
        .from('myusers')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();

      if (existingUser) {
        const { error: updateError } = await supabase
          .from('myusers')
          .update({ auth_uid: data.user.id, name: name.trim() })
          .eq('email', emailLower);
          
        if (updateError) console.warn('[signup] myusers update failed:', updateError.message);
      } else {
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

    router.replace('/(app)'); 
  }

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
          const urlParams = result.url.split('#')[1] || '';
          const searchParams = new URLSearchParams(urlParams);
          
          const access_token = searchParams.get('access_token');
          const refresh_token = searchParams.get('refresh_token');

          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            
            if (sessionError) throw sessionError;
          }
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
      colors={['#fff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
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
            paddingTop: insets.top + 24, 
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
  container: { 
    flex: 1, 
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 100,
    height: 100,
  },
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
  eyeIcon: {
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
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
    color: '#fff' 
  },
  link: { 
    color: '#ffffff', 
    fontWeight: '700', 
    textDecorationLine: 'underline', 
  },
});