import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LeaderboardTab() {
  return (
    <LinearGradient colors={['#ffffff', '#0d9488']} start={{ x: 0.2, y: 0.2 }} end={{ x: 0.8, y: 0.8 }} style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, title: { fontSize: 24, fontWeight: '700', color: '#0d9488' } });