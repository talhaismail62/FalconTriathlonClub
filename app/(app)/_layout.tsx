import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientHeader from '@/components/GradientHeader';

export default function AppLayout() {
  const { session, loading, isRecovering } = useAuth();
  const insets = useSafeAreaInsets();

  // Don't let a password-recovery session open the app.
  if (isRecovering) {
    return <Redirect href="/reset-password" />;
  }

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Float above the system nav bar, but keep it compact (Defect #13).
  const barBottom = Math.max(insets.bottom, 8) + 6;

  return (
    <Tabs
      screenOptions={{
        // ── Dynamic header (Defect #21) ──
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerBackground: () => <GradientHeader />,
        
        // ── Tab bar: darker, shorter, narrower (Defect #13) ──
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.65)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: -4,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: barBottom,
          marginHorizontal: 20, // Forces the bar to be narrower with space on left/right
          height: 60,
          paddingBottom: 0,
          paddingTop: 0,
          borderRadius: 25,
          borderTopWidth: 0,
          backgroundColor: '#0f766e', // Solid dark teal so it pops against the screen gradient
          elevation: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          overflow: 'hidden',
        },
      }}
    >
      {/* 1. Home Feed */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />

      {/* 2. Activities (Weekly Activities) */}
      <Tabs.Screen
        name="activities"
        options={{
          title: 'Activities',
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" size={size} color={color} />,
        }}
      />

      {/* 3. Chatbot */}
      <Tabs.Screen
        name="chatbot"
        options={{
          title: 'Sporty',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
        }}
      />

      {/* 4. Leaderboard */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />

      {/* 5. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />

      {/* DO NOT add map, merchandise, or registration here.
          Their files were deleted, so Expo Router won't look for them. */}
    </Tabs>
  );
}