import React from 'react';

const SineWave = ({ width, height, markers } : { width: number, height: number, markers: { radians: number, color: string }[] }) => {
  const padding = 20;
  const points = 100;
  const xScale = (2 * Math.PI) / points;
  const yScale = height - 2 * padding;

  const pathData = Array.from({ length: points + 1 }, (_, i) => {
      const x = i * xScale;
      const y = Math.sin(x / 2) ** 2;
      return [x * (width / (2 * Math.PI)), height - padding - y * yScale];
  }).reduce((acc, [x, y]) => acc + `L${x},${y}`, `M${0},${height - padding}`);

  const markerElements = markers.map(({ radians, color }, index) => {
      const x = (radians * width) / (2 * Math.PI);
      const y = Math.sin(radians / 2) ** 2 * yScale;
      const radius = index === 0 ? 10 : 5; // Make the first marker larger
      return (
          <circle
              key={index}
              cx={x}
              cy={height - padding - y}
              r={radius}
              fill={color}
          />
      );
  });

  return (
      <svg width={width} height={height}>
          <path d={pathData} fill="none" stroke="#F6F1D5" strokeWidth="5" />
          {markerElements}
      </svg>
  );
};

export default SineWave;
