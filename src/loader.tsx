import React, { ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { base } from 'viem/chains';
import { EthereumProvider as EthereumProviderFactory } from '@walletconnect/ethereum-provider';
import { http, createPublicClient, createWalletClient, custom, type WalletClient, type PublicClient, Chain, Address } from 'viem';
import { WC_PROJECT_ID } from './constants';
import EthereumProvider from 'node_modules/@walletconnect/ethereum-provider/dist/types/EthereumProvider';
import { createConfig, useAccount, useChainId, useChains, useConnect, useConnectorClient, useDisconnect, usePublicClient, useSwitchChain, useWalletClient, WagmiProvider } from 'wagmi';
import { base as baseWagmi } from 'wagmi/chains';
import { Config } from 'wagmi';
import { AddressBubble } from './util';

const WalletClientContext = createContext<{
    publicClient: PublicClient,
    walletClient: WalletClient,
    address: Address
} | null>(null);

export function useWalletClientContext(): {
    publicClient: PublicClient,
    walletClient: WalletClient,
    address: Address
} {
  return useContext(WalletClientContext)!!;
}

export function Loader({ children }: { children: ReactNode | ReactNode[] }) {
  const { connect: connectWallet, connectors } = useConnect()
  const { disconnect: disconnectWallet } = useDisconnect()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const connectorClient = useConnectorClient()
  const { address } = useAccount()
  const { chains, switchChain } = useSwitchChain()
  const [showWalletOptions, setShowWalletOptions] = useState(false)

  const verifySwitchedToChain = () => {
    walletClient?.getChainId()
    .then((chainId) => {
      console.log(`ChainID: ${chainId}`);
      if (chainId !== base.id) {
        console.log(`Switching to ${base.id}`)
        switchChain({ chainId: base.id })
      }
    })
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      verifySwitchedToChain()
    }, 4000);
    return () => clearInterval(intervalId);
  }, [walletClient]);

  const beginConnect = () => {
    setShowWalletOptions(true)
  }

  const disconnect = async () => {
    disconnectWallet()
  }

  const walletOptions = connectors.map((connector) => (
    <button key={connector.uid} onClick={() => {
      setShowWalletOptions(false)
      connectWallet({ connector })
    }}>
      {connector.name}
    </button>
  ))

  const renderTopBar = () => (
    <div className="top-bar" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
      <div>
        <h1 style={{ fontFamily: 'monospace'}}>🌙 Moons</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row'}}>
        {!address && !showWalletOptions && <button onClick={beginConnect}>Connect Wallet</button>}
        {!address && showWalletOptions && walletOptions}
        {address && <AddressBubble address={address} textColor='#3E3E3E' />}
        {address && <button onClick={disconnect}>Disconnect Wallet</button>}
      </div>
    </div>
  );

  if (!walletClient || !publicClient || !address) {
    return (
      <>
        {renderTopBar()}
        <div className="message">Connect to a wallet to continue</div>
      </>
    );
  }

  return (
    <WalletClientContext.Provider value={{ walletClient: walletClient!!, publicClient: publicClient!! as PublicClient, address }}>
      {renderTopBar()}
      {children}
    </WalletClientContext.Provider>
  );
}