import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { session, loading, isRecovering } = useAuth();

  // Mid password-reset: the recovery session is real but must not be treated
  // as a normal login.
  if (isRecovering) {
    return <Redirect href="/reset-password" />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Logged-in users go to the app, everyone else to the login screen.
  return session ? <Redirect href="/(app)" /> : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
