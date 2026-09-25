import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';

export default function EmptyState({ icon, color = colors.primary, text }) {
  return (
    <View style={styles.container}>
      <Feather name={icon} size={32} color={color} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
  },
});
