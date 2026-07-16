import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  url?: string | null;
  name: string;
  size: number;
}

export default function Avatar({ url, name, size }: AvatarProps) {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  };

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (url) {
    return (
      <Image
        source={{ uri: url, cache: 'default' }} // Forces OS-level caching for instant loads
        style={[styles.avatarImage, containerStyle]}
        fadeDuration={0}
      />
    );
  }

  return (
    <View style={[styles.fallbackContainer, containerStyle]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.35 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    backgroundColor: '#f1f5f9',
    resizeMode: 'cover',
  },
  fallbackContainer: {
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0d9488',
  },
  fallbackText: {
    color: '#0d9488',
    fontWeight: '700',
  },
});