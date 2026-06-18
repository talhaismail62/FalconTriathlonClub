import { StyleSheet, Text, View } from 'react-native';

type AvatarProps = {
  /** Used to derive initials shown inside the circle. */
  name?: string | null;
  size?: number;
};

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export default function Avatar({ name, size = 120 }: AvatarProps) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: '#d6e4ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#adc6ff',
  },
  initials: {
    color: '#1d39c4',
    fontWeight: '700',
  },
});
