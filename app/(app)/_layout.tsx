import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Built into Expo, no install needed

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // We'll add custom headers inside the screens later
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          height: 65,
          borderRadius: 30,
          elevation: 0,
          shadowColor: '#0d9488',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['#0d9488', '#14b8a6']} // Teal gradient for the bar
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        ),
        headerBackground: () => require('@/components/GradientHeader').default
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
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
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
        name="merchandise"
        options={{
          href: null, // Hides it
          headerShown: true,
          title: "Merchandise Order",
          headerTintColor: '#ffffff',
          headerStyle: { elevation: 0, shadowColor: 'transparent' },
          headerBackground: () => (
            <LinearGradient
              colors={['#0d9488', '#14b8a6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          ),
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
          headerBackground: () => (
            <LinearGradient
              colors={['#0d9488', '#14b8a6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          ),
        }}
      />
    </Tabs>

  );
}