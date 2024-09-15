import React, { useRef, useEffect, useState } from 'react';

const SineWave = ({ height, markers }: { height: number, markers: { radians: number, color: string, radius: number }[] }) => {
  const svgRef: React.RefObject<SVGSVGElement> = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        setWidth(svgRef.current.clientWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const padding = 20;
  const points = 100;
  const xScale = (2 * Math.PI) / points;
  const yScale = height - 2 * padding;

  const pathData = Array.from({ length: points + 1 }, (_, i) => {
      const x = i * xScale;
      const y = Math.sin(x / 2) ** 2;
      return [x * (width / (2 * Math.PI)), height - padding - y * yScale];
  }).reduce((acc, [x, y]) => acc + `L${x},${y}`, `M${0},${height - padding}`);

  const markerElements = markers.map(({ radians, color, radius }, index) => {
      const x = (radians * width) / (2 * Math.PI);
      const y = Math.sin(radians / 2) ** 2 * yScale;
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
      <svg
          ref={svgRef}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
      >
          <path d={pathData} fill="none" stroke="#FFEBB9" strokeWidth="5" />
          {markerElements}
      </svg>
  );
};

export default SineWave;
