import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Screen background: dark teal at the top so status-bar icons stay readable, then white, then teal. */
export const SCREEN_GRADIENT = {
  colors: ['#0f766e', '#ffffff', '#0d9488'] as const,
  locations: [0, 0.16, 1] as const,
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
};

/** Shared layout rhythm used across screens. */
export const SPACE = {
  screen: 16,
  section: 24,
  stack: 12,
};

export function GradientButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      style={[styles.buttonContainer, disabled && styles.buttonDisabled]}
    >
      <LinearGradient
        colors={['#0d9488', '#14b8a6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientButton}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 0,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  gradientButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: SPACE.stack,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});