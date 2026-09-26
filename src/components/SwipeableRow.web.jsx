import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { strings } from '../strings';

// Web: kaydırma yok (plan W7). Fare satırın üzerine gelince ya da klavyeyle
// odaklanınca satırın sağında sil butonu görünür. Görünmezken de yerini
// korur (satır zıplamaz) ve ekran okuyucular için hep oradadır.
// children: rowProps => satır; rowProps.trailing satırın sonuna eklenir.
export default function SwipeableRow({ title, onDelete, children }) {
  const { colors } = useTheme();
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // Yalnızca fare: dokunmatik ekranda görünmez butona yanlışlıkla basılmasın.
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const enter = e => e.pointerType === 'mouse' && setHovered(true);
    const leave = () => setHovered(false);
    node.addEventListener('pointerenter', enter);
    node.addEventListener('pointerleave', leave);
    return () => {
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', leave);
    };
  }, []);

  const visible = hovered || focused;
  const trailing = (
    <TouchableOpacity
      onPress={onDelete}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={strings.swipe.deleteTask(title)}
      style={[styles.delete, !visible && styles.hidden]}
    >
      <Feather name="trash-2" size={16} color={colors.danger} />
    </TouchableOpacity>
  );

  return (
    <View ref={ref} style={styles.container}>
      {children({ trailing })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  // Dokunma alanı geniş, ama tek satırlık görevde satırı uzatmasın.
  delete: {
    padding: 6,
    marginVertical: -6,
    borderRadius: 8,
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
});
