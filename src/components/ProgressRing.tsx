import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export function ProgressRing({
  size = 150,
  stroke = 14,
  progress = 0.82,
  trackColor = "rgba(10,18,35,0.08)",
  progressColor = "#2E6BFF",
}: {
  size?: number;
  stroke?: number;
  progress?: number; // 0..1
  trackColor?: string;
  progressColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dash = c * p;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={progressColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
    </View>
  );
}
