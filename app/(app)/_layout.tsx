import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientHeader from '@/components/GradientHeader';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Float above the system nav bar, but keep it compact (Defect #13).
  const barBottom = Math.max(insets.bottom, 8) + 6;

  return (
    <Tabs
      screenOptions={{
        // ── Dynamic header (Defect #21) ──
        // Replaces the fixed custom app bar in individual screens with Expo
        // Router's managed header, which adapts to safe-area and scroll state.
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerBackground: () => <GradientHeader />,
        // Safe-area top spacing is handled by the header itself (Defect #14).

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
          left: 40,          // narrower — more horizontal margin
          right: 40,
          height: 60,        // shorter
          paddingBottom: 0,
          paddingTop: 0,
          borderRadius: 22,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 6,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          overflow: 'hidden',  // prevents clipped-corner artefacts
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['#0f766e', '#0d9488']}   // darker teal
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 22 }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Falcon Triathlon',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: 'Activities',
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: 'Sporty',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}