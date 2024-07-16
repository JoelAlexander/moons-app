import React from 'react';

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
    border: '2px solid #007BFF',
    borderRadius: '20px',
    cursor: 'pointer',
    userSelect: 'none',
  } as React.CSSProperties,
};
