import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function DonutChart({
  size = 170,
  stroke = 22,
  segments,
}: {
  size?: number;
  stroke?: number;
  segments: { value: number; color: string }[];
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {segments.map((seg, i) => {
          const v = clamp01(seg.value / sum);
          const dash = c * v;
          const gap = c - dash;
          const offset = c * acc;
          acc += v;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={seg.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              rotation={-90}
              originX={size / 2}
              originY={size / 2}
            />
          );
        })}
      </Svg>
    </View>
  );
}
