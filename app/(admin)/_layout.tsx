import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import GradientHeader from '@/components/GradientHeader';

export default function AdminLayout() {
  const { session, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAdminStatus() {
      if (!session?.user?.email) {
        if (active) setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('myusers')
          .select('is_admin')
          .eq('email', session.user.email.toLowerCase())
          .single();

        if (active) {
          if (error || !data?.is_admin) {
            setIsAdmin(false);
          } else {
            setIsAdmin(true);
          }
        }
      } catch (err) {
        console.error("Database check crashed:", err);
        if (active) setIsAdmin(false);
      }
    }

    checkAdminStatus();

    return () => {
      active = false;
    };
  }, [session]);

  // 1. Loading authentication or checking database permissions
  if (authLoading || isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  // 2. Not logged in -> Auth Screen
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Logged in, but is NOT an admin -> Safely back out to Root path
  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  // 4. Authorized Admin
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
      <Stack.Screen name="manage-activities" options={{ title: 'Manage Activities' }} />
    </Stack>
  );
}