import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export function MacroRing({
  size = 120,
  stroke = 12,
  rings,
  trackColor = "rgba(10,18,35,0.07)",
}: {
  size?: number;
  stroke?: number;
  rings: { progress: number; color: string }[]; // outer->inner
  trackColor?: string;
}) {
  const center = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {rings.map((r, idx) => {
          const inset = idx * (stroke + 4);
          const radius = (size - stroke) / 2 - inset;
          const c = 2 * Math.PI * radius;
          const p = Math.max(0, Math.min(1, r.progress));
          const dash = c * p;
          return (
            <React.Fragment key={idx}>
              <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={r.color}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c - dash}`}
                rotation={-90}
                originX={center}
                originY={center}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
