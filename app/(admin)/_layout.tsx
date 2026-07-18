import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, [session]);

  async function checkAdminStatus() {
    if (!session?.user?.email) {
      setIsAdmin(false);
      return;
    }
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

  if (authLoading || isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!isAdmin) return <Redirect href="/(app)" />;

  return (
    <Stack 
      screenOptions={{
        headerShown: true,
        headerTransparent: false, // Prevents background bleed
        headerShadowVisible: false,
        headerTintColor: '#ffffff',
        headerStyle: { backgroundColor: '#0d9488' }, // Solid header color
        headerTitleStyle: { color: '#ffffff', fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin Panel' }} />
      <Stack.Screen name="manage-posts" options={{ title: 'Manage Posts' }} />
      <Stack.Screen name="verify-payments" options={{ title: 'Verify Payments' }} />
    </Stack>
  );
}