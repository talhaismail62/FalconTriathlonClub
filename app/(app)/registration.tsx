import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardContainer, GradientButton } from '@/components/UI';

export default function RegistrationScreen() {
  const { session } = useAuth();
  const user = session?.user;

  // Pre-fill form with authenticated user's data for better UX
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim()) {
      return Alert.alert("Error", "Please fill out all fields.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('event_registrations').insert({
        auth_uid: user?.id, // links registration to user account
        name: name.trim(),
        email: email.trim(),
      });

      if (error) throw error;
      
      Alert.alert("Success", "You are registered for the event!");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
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
      {/* REMOVED THE MANUAL HEADER VIEW HERE */}

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <CardContainer>
          <Text style={styles.label}>Full Name</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter your name" 
            placeholderTextColor="#94a3b8"
            value={name} 
            onChangeText={setName} 
          />
        </CardContainer>

        <CardContainer>
          <Text style={styles.label}>Email Address</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter your email" 
            placeholderTextColor="#94a3b8"
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none" 
          />
        </CardContainer>

        <GradientButton 
          label={loading ? "Registering..." : "Register Now"} 
          onPress={handleRegister} 
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 20 },
  label: { 
    fontSize: 14, fontWeight: '600', color: '#64748b', 
    marginBottom: 8, textTransform: 'uppercase' 
  },
  input: { 
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, 
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, 
    backgroundColor: '#f8fafc', color: '#0f172a' 
  },
});