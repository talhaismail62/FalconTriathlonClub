import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

export default function GradientHeader() {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#0d9488', '#14b8a6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}