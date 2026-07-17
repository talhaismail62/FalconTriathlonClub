import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Built into Expo, no install needed
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientHeader from '@/components/GradientHeader';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  // Float the bar above the system nav (gesture/button bar) using the bottom inset.
  const barBottom = Math.max(insets.bottom, 12) + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // We'll add custom headers inside the screens later
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.75)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: barBottom,
          left: 16,
          right: 16,
          height: 72,
          paddingBottom: 0,
          borderRadius: 28,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: '#0d9488',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['rgba(13,148,136,0.85)', 'rgba(20,184,166,0.85)']} // teal "liquid glass" — translucent but readable
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              borderRadius: 28,
            }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index" // This maps to app/(app)/index.tsx
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
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
        name="activities"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
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
      <Tabs.Screen
        name="map"
        options={{
          href: null, // Hidden until the club map feature is built out
        }}
      />
      <Tabs.Screen
        name="merchandise"
        options={{
          href: null, // Hides it
          headerShown: true,
          title: "Merchandise Order",
          headerTintColor: '#ffffff',
          headerStyle: { elevation: 0, shadowColor: 'transparent' },
          headerBackground: () => <GradientHeader />,
        }}
      />
      <Tabs.Screen
        name="registration"
        options={{
          href: null,
          headerShown: true,
          title: "Event Registration",
          headerTintColor: '#ffffff',
          headerStyle: { elevation: 0, shadowColor: 'transparent' },
          headerBackground: () => <GradientHeader />,
        }}
      />
    </Tabs>

  );
}