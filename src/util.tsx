import React, { useState } from 'react';
import { Address } from 'viem';
import SineWave from './sine';

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

export const AboutMoons = () => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const sampleOffset = 1

  const markers = [
    { radians: sampleOffset, radius: 6, color: getColorFromAddress('0x1') },
    { radians: sampleOffset + ((1 / 5 ) * (2 * Math.PI)), radius: 6, color: getColorFromAddress('0x2') },
    { radians: sampleOffset + ((2 / 5 ) * (2 * Math.PI)), radius: 6, color: getColorFromAddress('0x3') },
    { radians: sampleOffset + ((3 / 5 ) * (2 * Math.PI)), radius: 6, color: getColorFromAddress('0x4') },
    { radians: sampleOffset + ((4 / 5 ) * (2 * Math.PI)), radius: 6, color: getColorFromAddress('0x5') }
  ]

  const screens = [
    {
      content: (
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ fontFamily: 'monospace', color: '#F6F1D5', margin: '0' }}>Moons Protocol</h1>
          <p style={{ fontSize: '1.2rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>Seamless, trust-based funding designed to maximize your community's agency and impact.</p>
          <button
            onClick={() => setCurrentScreen(1)}
            style={{
              color: '#F6F1D5',
              backgroundColor: '#444',
              border: 'none',
              padding: '1rem 2rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              marginTop: '1rem',
            }}
          >
            Learn More
          </button>
        </div>
      ),
    },
    {
      content: <div style={{ textAlign: 'left' }}>
        <h2 style={{ color: '#F6F1D5', justifyContent: 'left', margin: '0' }}>How it Works</h2>
        <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>Moons protocol funds are smart contracts that hold and disburse ERC20 tokens such as USDC.</p>
        <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>Each fund is deployed with a fixed cycle time that defines how frequenly participants may access funds.</p>
        <SineWave width={400} height={120} markers={markers} />
        <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>Participants may disburse funds once per cycle, up to thier current allowance.</p>
        <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>The percentage of the fund allowed to each participant oscillates sinusoidally during the cycle.</p>
        <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>The maximum allowance percentage is determined by the formula 1/sqrt(n) where n is the number of participants.</p>
      </div>,
    },
    {
      content: <div style={{ textAlign: 'left' }}>
      <h2 style={{ color: '#F6F1D5', justifyContent: 'left', margin: '0' }}>Administration</h2>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>Anyone can deploy a fund, customizing its cycle time, name and description.</p>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '1rem' }}>The deployer of a Moons protocol fund is the first administrator.</p>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '1rem' }}>To manage the fund, administrators may add new administrators and participants, as well as remove participants and other later-added administrators.</p>     
    </div>,
    },
    {
      content: <div style={{ textAlign: 'left' }}>
      <h2 style={{ color: '#F6F1D5', justifyContent: 'left', margin: '0' }}>Vision</h2>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>Imagine pooling funds for big family meals, where each member’s contribution potential fluctuates fairly and anyone can add to the pot anytime.</p>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '1rem' }}>Envision robotics teams using Moons protocol for fair, cyclical budgets. Students manage funds strategically, with community donations boosting their potential.</p>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '1rem' }}>Picture a community garden thriving where gardeners have access to fair, fluctuating funds for supplies, while neighbors can donate anytime to support local greenery.</p>
    </div>,
    },
    {
      content: <div style={{ textAlign: 'left' }}>
      <h2 style={{ color: '#F6F1D5', justifyContent: 'left', margin: '0' }}>What you'll need</h2>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '0.5rem' }}>To deploy or participate in Moons protocol contracts, you will need a compatible Ethereum wallet.</p>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '1rem' }}>Moons protocol supports WalletConnect compatible wallets such as Trust or Metamask, as well as Coinbase Wallet.</p>
      <p style={{ fontSize: '1rem', color: '#F6F1D5', margin: '0', marginTop: '1rem' }}>Moons protocol currently only supports USDC on Base.</p>
    </div>,
    },
  ];

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const handlePrevious = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '480px', padding: '1rem' }}>
        <div style={{ flexGrow: 1 }}>
          {screens[currentScreen].content}
        </div>
        {currentScreen > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1rem' }}>
              <button onClick={handlePrevious} disabled={currentScreen === 0} style={{ color: '#F6F1D5', backgroundColor: '#444', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                Previous
              </button>
              {currentScreen !== screens.length - 1 && <button onClick={handleNext} disabled={currentScreen === screens.length - 1} style={{ color: '#F6F1D5', backgroundColor: '#444', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                Next
              </button>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              {screens.slice(1).map((_, index) => (
                <div key={index} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: index + 1 === currentScreen ? '#F6F1D5' : '#555', margin: '0 4px' }}></div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
