import React from 'react';
import { TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

// Replaces the old 👁 / 🙈 emoji toggle with real line icons - shared since
// both the Home and Wallet balance headers use the identical eye/eye-slash
// pair, both now sitting on a solid violet background.
export default function EyeToggle({
  hidden,
  onPress,
  color = '#FFFFFF',
  size = 18,
}: {
  hidden: boolean;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={10} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {hidden ? (
          <Path
            d="M17.9 17.9A11 11 0 0112 19c-7 0-11-7-11-7a20.6 20.6 0 015-5.9M9.9 4.2A10.6 10.6 0 0112 4c7 0 11 7 11 7a20.4 20.4 0 01-3.2 4.2M14.1 14.1a3 3 0 11-4.2-4.2M2 2l20 20"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
          </>
        )}
      </Svg>
    </TouchableOpacity>
  );
}
