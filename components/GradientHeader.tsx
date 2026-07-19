import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

export default function GradientHeader() {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#065f57', '#0d9488']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}