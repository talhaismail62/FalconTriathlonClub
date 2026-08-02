import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT, tabBarBottomOffset } from '@/components/tabBarLayout';

export default function AppLayout() {
  // const { session, loading, isRecovering } = useAuth();
  const insets = useSafeAreaInsets();

  // if (isRecovering) {
  //   return <Redirect href="/reset-password" />;
  // }

  // if (!loading && !session) {
  //   return <Redirect href="/(auth)/login" />;
  // }

  const barBottom = tabBarBottomOffset(insets);

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Removed App Bar
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
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: barBottom,
          marginHorizontal: 20,
          height: TAB_BAR_HEIGHT,
          paddingBottom: 0,
          paddingTop: 0,
          borderRadius: 25,
          borderTopWidth: 0,
          backgroundColor: '#0f766e',
          elevation: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          overflow: 'hidden',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
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
        name="chatbot"
        options={{
          title: 'Sporty',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />

      {/* --- HIDDEN FROM TAB BAR --- */}
      <Tabs.Screen
        name="map"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="merchandise"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="registration"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}