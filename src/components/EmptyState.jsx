import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';

export default function EmptyState({ icon, color, text }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Feather name={icon} size={32} color={color ?? colors.primary} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
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
