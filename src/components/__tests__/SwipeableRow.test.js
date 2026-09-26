import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import SwipeableRow from '../SwipeableRow';
import { swipeAction, SWIPE_RATIO } from '../swipe';

// Simge yazı tipi yüklemesi testte gerekmez.
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

describe('swipeAction', () => {
  test('eşik satır genişliğinin 1/3ü', () => {
    expect(SWIPE_RATIO).toBeCloseTo(1 / 3);
    expect(swipeAction(100, 300)).toBe('complete');
    expect(swipeAction(99, 300)).toBeNull();
    expect(swipeAction(-100, 300)).toBe('delete');
    expect(swipeAction(-99, 300)).toBeNull();
    expect(swipeAction(0, 300)).toBeNull();
  });

  test('genişlik ölçülmeden işlem yapılmaz', () => {
    expect(swipeAction(500, 0)).toBeNull();
    expect(swipeAction(-500, undefined)).toBeNull();
  });
});

// Mobil satır: hareket, eşik ve ekran okuyucu eylemleri.
function renderRow({ done = false } = {}) {
  const onComplete = jest.fn();
  const onDelete = jest.fn(() => Promise.resolve());
  let received;
  let tree;
  act(() => {
    tree = TestRenderer.create(
      <SwipeableRow testID="row" title="Kitap oku" done={done} onComplete={onComplete} onDelete={onDelete}>
        {rowProps => {
          received = rowProps;
          return <Text>Kitap oku</Text>;
        }}
      </SwipeableRow>,
    );
  });
  // Satır genişliği ölçülür (300 px → eşik 100 px).
  const container = tree.root.findAll(node => typeof node.props.onLayout === 'function')[0];
  act(() => container.props.onLayout({ nativeEvent: { layout: { width: 300, height: 60 } } }));
  return { tree, onComplete, onDelete, rowProps: () => received };
}

function swipe(translationX) {
  act(() => {
    fireGestureHandler(getByGestureTestId('row'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: translationX / 2 },
      { state: State.ACTIVE, translationX },
      { state: State.END, translationX },
    ]);
  });
}

test('sağa eşiği geçince tamamlar', () => {
  const { onComplete, onDelete } = renderRow();
  swipe(120);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onDelete).not.toHaveBeenCalled();
});

test('sola eşiği geçince siler', () => {
  const { onComplete, onDelete } = renderRow();
  swipe(-120);
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
});

test('eşiğin altında bırakılınca bir şey olmaz', () => {
  const { onComplete, onDelete } = renderRow();
  swipe(80);
  swipe(-80);
  expect(onComplete).not.toHaveBeenCalled();
  expect(onDelete).not.toHaveBeenCalled();
});

test('ekran okuyucu eylemleri: Tamamla / Geri aç ve Sil', () => {
  const { onComplete, onDelete, rowProps } = renderRow();
  expect(rowProps().accessibilityActions).toEqual([
    { name: 'complete', label: 'Tamamla' },
    { name: 'delete', label: 'Sil' },
  ]);
  rowProps().onAccessibilityAction({ nativeEvent: { actionName: 'complete' } });
  rowProps().onAccessibilityAction({ nativeEvent: { actionName: 'delete' } });
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledTimes(1);

  const reopened = renderRow({ done: true });
  expect(reopened.rowProps().accessibilityActions[0].label).toBe('Geri aç');
});
