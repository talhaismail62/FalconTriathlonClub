import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          {/* Top-level (not inside (auth)) so the recovery session doesn't
              trigger the "already signed in" redirect to /(app). */}
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="(app)" />
          {/* presentation: 'fullScreenModal' prevents Admin Panel from rendering inside the tab bar */}
          <Stack.Screen name="(admin)" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}