import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** The Housie Tambola King logo (assets/logo.png — made from the owner's artwork, transparent corners). */
const LOGO = require('../../assets/logo.png');

/**
 * The app logo — the artwork already says "Housie Tambola King", so it is the title.
 *  - "large": Welcome screen (big, centred)
 *  - "small": Home header
 */
export function Wordmark({ size = 'large' }: { size?: 'large' | 'small' }) {
  const side = size === 'large' ? 200 : 78;
  return (
    <View style={[styles.wrap, { width: side, height: side, borderRadius: side * 0.22 }, size === 'large' && { alignSelf: 'center' }]}>
      <Image source={LOGO} style={{ width: side, height: side }} resizeMode="contain" accessibilityLabel="Housie Tambola King" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
});
