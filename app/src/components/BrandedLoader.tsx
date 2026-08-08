import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Image } from 'react-native';

// A pulsing brand mark used in place of the generic OS spinner on the app's
// main full-screen loading states (Home, Trade, Bills) - small inline
// loaders (e.g. "verifying account…" next to a text field) stay as plain
// ActivityIndicators, where a full logo animation would be oversized.
export default function BrandedLoader({ size = 56 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }], opacity }]}>
      <Image
        source={require('../assets/logo-mark.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
