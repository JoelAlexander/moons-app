import React, { useState } from 'react';
import { Address } from 'viem';
import SineWave from './sine';
import { PRESET_TOKENS } from './constants';
import { Token } from '@coinbase/onchainkit/token';

export function formatUSDC(amount: bigint): string {
  const usdcDecimals = 6n; // USDC has 6 decimal places
  const fprimary = 10n ** usdcDecimals;
  const integerPart = amount / fprimary;
  const fractionalPart = amount % fprimary;

  const fractionalString = fractionalPart.toString().padStart(Number(usdcDecimals), '0').slice(0, 2);
  return `${integerPart.toString()}.${fractionalString}`;
}

const colors = [
  "#FF5733", "#33FF57", "#5733FF", "#FF33A1", "#33FFA1", "#A133FF", 
  "#FF9633", "#33FF96", "#9633FF", "#FF3396", "#33FFCC", "#3396FF",
  "#FFCC33", "#33CCFF", "#CC33FF", "#FF3366", "#66FF33", "#6633FF",
  "#FF6F33", "#33FF6F", "#6F33FF", "#FF338F", "#33FF8F", "#8F33FF",
  "#FFB733", "#33FFB7", "#B733FF", "#FF337F", "#33FFDF", "#337FFF",
  "#FFD633", "#33D6FF", "#D633FF", "#FF3377", "#77FF33", "#7733FF",
  "#FF7043", "#43FF70", "#7043FF", "#FF438B", "#43FF8B", "#8B43FF",
  "#FFA143", "#43FFA1", "#A143FF", "#FF4377", "#43FFDD", "#4377FF",
  "#FFDA43", "#43DAFF", "#DA43FF", "#FF4373", "#73FF43", "#7343FF",
  "#FF8633", "#33FF86", "#8633FF", "#FF3386", "#33FFAA", "#3386FF",
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

export const getTokenByAddress = (address: Address): Token | undefined => {
  return PRESET_TOKENS.find(token => token.address === address);
};

export const getTokenDecimals = (address: Address): number => {
  const token = getTokenByAddress(address);
  return token ? token.decimals : 18;
};

export const formatTokenBalance = (balance: bigint, decimals: number): string => {
  return (Number(balance) / Math.pow(10, decimals)).toFixed(2);
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
          <h1 style={{ fontFamily: 'monospace', color: '#FFEBB9', margin: '0' }}>Moons Protocol</h1>
          <p style={{ fontSize: '1.2rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>Seamless, trust-based funding designed to maximize your community's agency and impact.</p>
          <button
            onClick={() => setCurrentScreen(1)}
            style={{
              color: '#FFEBB9',
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
        <h2 style={{ color: '#FFEBB9', justifyContent: 'left', margin: '0' }}>How it Works</h2>
        <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>Moons protocol funds are smart contracts that hold and disburse ERC20 tokens such as USDC.</p>
        <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>Each fund is deployed with a fixed cycle time that defines how frequenly participants may access funds.</p>
        <SineWave height={120} markers={markers} />
        <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>Participants may disburse funds once per cycle, up to their current allowance.</p>
        <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>The percentage of the fund allowed to each participant oscillates sinusoidally during the cycle.</p>
        <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>The maximum allowance percentage is determined by the formula 1/sqrt(n) where n is the number of participants.</p>
      </div>,
    },
    {
      content: <div style={{ textAlign: 'left' }}>
      <h2 style={{ color: '#FFEBB9', justifyContent: 'left', margin: '0' }}>Administration</h2>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>Anyone can deploy a fund, customizing its cycle time, name and description.</p>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '1rem' }}>The deployer of a Moons protocol fund is the first administrator.</p>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '1rem' }}>To manage the fund, administrators may add new administrators and participants, as well as remove participants and other later-added administrators.</p>     
    </div>,
    },
    {
      content: <div style={{ textAlign: 'left' }}>
      <h2 style={{ color: '#FFEBB9', justifyContent: 'left', margin: '0' }}>Vision</h2>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>Imagine pooling funds for big family meals, where each contributor can claim their own fair reimbursment and anyone can add to the pot anytime.</p>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '1rem' }}>Envision robotics teams using Moons protocol for fair, cyclical budgets. Students manage funds strategically, with community donations boosting their potential.</p>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '1rem' }}>Picture a community garden thriving where gardeners have access to fair, fluctuating funds for supplies, while neighbors can donate anytime to support local greenery.</p>
    </div>,
    },
    {
      content: <div style={{ textAlign: 'left' }}>
      <h2 style={{ color: '#FFEBB9', justifyContent: 'left', margin: '0' }}>What you'll need</h2>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '0.5rem' }}>To deploy or participate in Moons protocol contracts, you will need a compatible Ethereum wallet.</p>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '1rem' }}>Moons protocol supports WalletConnect compatible wallets such as Trust or Metamask, as well as Coinbase Wallet.</p>
      <p style={{ fontSize: '1rem', color: '#FFEBB9', margin: '0', marginTop: '1rem' }}>Moons protocol currently only supports USDC on Base.</p>
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
      <div style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
        <div style={{ flexGrow: 1 }}>
          {screens[currentScreen].content}
        </div>
        {currentScreen > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1rem' }}>
              <button onClick={handlePrevious} disabled={currentScreen === 0} style={{ color: '#FFEBB9', backgroundColor: '#444', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                Previous
              </button>
              {currentScreen !== screens.length - 1 && <button onClick={handleNext} disabled={currentScreen === screens.length - 1} style={{ color: '#FFEBB9', backgroundColor: '#444', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                Next
              </button>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              {screens.slice(1).map((_, index) => (
                <div key={index} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: index + 1 === currentScreen ? '#FFEBB9' : '#555', margin: '0 4px' }}></div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
