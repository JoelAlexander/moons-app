import React from 'react';
import { Address } from 'viem';

const colors = [
  "#FF5733", "#33FF57", "#5733FF", "#FF33A1", "#33FFA1", "#A133FF", 
  "#FF9633", "#33FF96", "#9633FF", "#FF3396", "#33FFCC", "#3396FF",
  "#FFCC33", "#33CCFF", "#CC33FF", "#FF3366", "#66FF33", "#6633FF",
];

export const getColorFromAddress = (address: Address): string => {
  // Create a simple hash of the address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Ensure the hash is positive
  hash = Math.abs(hash);

  // Get a color from the colors array
  const colorIndex = hash % colors.length;

  return colors[colorIndex];
}

export const AddressBubble = ({ address, textColor, onLongPress}: { address: string, textColor: string, onLongPress?: () => void}) => {
  const abbreviateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  let timer: NodeJS.Timeout;

  const handleMouseDown = () => {
    if (onLongPress) {
      timer = setTimeout(onLongPress, 1000);
    }
  };

  const handleMouseUp = () => {
    clearTimeout(timer);
  };

  const copyToClipboard = (addr: string) => {
    navigator.clipboard.writeText(addr);
    alert('Address copied to clipboard');
  };

  return (
    <p
      style={{...styles.bubble, color: textColor }}
      onClick={() => copyToClipboard(address)}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {abbreviateAddress(address)}
    </p>
  );
};

const styles = {
  bubble: {
    display: 'inline-block',
    padding: '5px 10px',
    border: '2px solid #999999',
    borderRadius: '20px',
    cursor: 'pointer',
    userSelect: 'none',
    marginRight: '0.5em',
    marginBottom: '0.5em'
  } as React.CSSProperties,
};
