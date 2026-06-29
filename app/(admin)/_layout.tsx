import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import GradientHeader from '@/components/GradientHeader';

export default function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = checking, false = no, true = yes

  useEffect(() => {
    checkAdminStatus();
  }, [session]);

  async function checkAdminStatus() {
    if (!session?.user?.email) {
      setIsAdmin(false);
      return;
    }

    // Ask the database directly, not the JWT token
    const { data, error } = await supabase
      .from('myusers')
      .select('is_admin')
      .eq('email', session.user.email.toLowerCase())
      .single();

    if (error || !data?.is_admin) {
      setIsAdmin(false);
    } else {
      setIsAdmin(true);
    }
  }

  // 1. Still loading auth or checking database
  if (authLoading || isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  // 2. Not logged in at all
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Logged in, but database says NOT an admin
  if (!isAdmin) {
    return <Redirect href="/(app)" />; 
  }

  // 4. Logged in AND is admin
  return (
    <Stack 
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: '#ffffff',
        headerBackground: () => <GradientHeader />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin Panel' }} />
      <Stack.Screen name="manage-posts" options={{ title: 'Manage Posts' }} />
      <Stack.Screen name="verify-payments" options={{ title: 'Verify Payments' }} />
    </Stack>
  );
}