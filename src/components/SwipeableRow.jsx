import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { onColor, useTheme } from '../theme';
import { swipeAction } from './swipe';
import { strings } from '../strings';

const t = strings.swipe;

// Mobil: görev satırı sağa kaydırılınca tamamlanır (tamamlanmışsa geri açılır),
// sola kaydırılınca silinir; eşik satır genişliğinin 1/3'ü (swipe.js).
// Ekran okuyucu aynı işlemleri satırın eylemleri olarak bulur.
// children: rowProps => satır; rowProps satırın dokunulabilir öğesine verilir.
// Web sürümü SwipeableRow.web.jsx içindedir.
export default function SwipeableRow({ done, onComplete, onDelete, testID, children }) {
  const { colors } = useTheme();
  const width = useSharedValue(0);
  const x = useSharedValue(0);

  const pan = useMemo(() => {
    const remove = () => Promise.resolve(onDelete()).finally(() => { x.value = 0; });
    const gesture = Gesture.Pan()
      // Dikey kaydırma liste içindir; yatay hareket 15 px'i geçince satır kayar.
      .activeOffsetX([-15, 15])
      .failOffsetY([-10, 10])
      .onUpdate(e => {
        x.value = e.translationX;
      })
      .onEnd(e => {
        const action = swipeAction(e.translationX, width.value);
        if (action === 'delete') {
          x.value = withTiming(-width.value, { duration: 160 }, finished => {
            if (finished) runOnJS(remove)();
          });
        } else {
          x.value = withTiming(0, { duration: 160 });
          if (action === 'complete') runOnJS(onComplete)();
        }
      });
    return testID ? gesture.withTestId(testID) : gesture;
  }, [onComplete, onDelete, testID, width, x]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const completeStyle = useAnimatedStyle(() => ({ opacity: x.value > 0 ? 1 : 0 }));
  const deleteStyle = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));

  const completeLabel = done ? t.reopen : t.complete;
  const rowProps = {
    accessibilityActions: [
      { name: 'complete', label: completeLabel },
      { name: 'delete', label: t.delete },
    ],
    onAccessibilityAction: e => {
      if (e.nativeEvent.actionName === 'complete') onComplete();
      else if (e.nativeEvent.actionName === 'delete') onDelete();
    },
  };

  return (
    <View style={styles.container} onLayout={e => { width.value = e.nativeEvent.layout.width; }}>
      <Animated.View style={[styles.action, styles.left, { backgroundColor: colors.primary }, completeStyle]}>
        <Feather name={done ? 'rotate-ccw' : 'check'} size={18} color={colors.onPrimary} />
        <Text style={[styles.actionText, { color: colors.onPrimary }]}>{completeLabel}</Text>
      </Animated.View>
      <Animated.View style={[styles.action, styles.right, { backgroundColor: colors.danger }, deleteStyle]}>
        <Text style={[styles.actionText, { color: onColor(colors.danger) }]}>{t.delete}</Text>
        <Feather name="trash-2" size={18} color={onColor(colors.danger)} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children(rowProps)}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  action: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  left: {
    justifyContent: 'flex-start',
  },
  right: {
    justifyContent: 'flex-end',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
