import React, { ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { base } from 'viem/chains';
import { type WalletClient, type PublicClient, Address as AddressString } from 'viem';
import { Connector, useAccount, useConnect, useConnections, useConnectorClient, useDisconnect, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import { AddressBubble } from './util';
import { 
  ConnectWallet, 
  Wallet, 
  WalletDropdown, 
  WalletDropdownLink, 
  WalletDropdownDisconnect, 
} from '@coinbase/onchainkit/wallet'; 
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from '@coinbase/onchainkit/identity';

const WalletClientContext = createContext<{
    publicClient: PublicClient,
    walletClient: WalletClient | undefined,
    address: AddressString
} | null>(null);

export function useWalletClientContext(): {
    publicClient: PublicClient,
    walletClient: WalletClient | undefined,
    address: AddressString
} {
  return useContext(WalletClientContext)!!;
}

export function Loader({ children }: { children: ReactNode | ReactNode[] }) {
  //const connections = useConnections()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()

  // const verifySwitchedToChain = () => {
  //   const connection = connections[0]
  //   if (!connection || !walletClient) return
  //   walletClient?.getChainId()
  //   .then((chainId) => {
  //     if (chainId !== base.id) {
  //       console.log(`Switching to ${base.id}`)
  //       switchChain({ chainId: base.id, connector: connection.connector })
  //     }
  //   })
  // }

  // useEffect(() => {
  //   const intervalId = setInterval(() => {
  //     verifySwitchedToChain()
  //   }, 4000);
  //   return () => clearInterval(intervalId);
  // }, [walletClient]);

  const renderTopBar = () => {
    const connectWalletClassName = address ? 'bg-white' : 'bg-black'
    return (
      <div className="top-bar" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
        <div>
          <h1 style={{ fontFamily: 'monospace', lineHeight: '1', padding: '0px', margin: '0px' }}>🌙 Moons</h1>
        </div>

        <Wallet>
          <ConnectWallet withWalletAggregator={true} className={connectWalletClassName}>
            <Avatar />
            <Name />
          </ConnectWallet>
          <WalletDropdown>
            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
              <Avatar />
              <Name chain={base} />
              <Address />
              <EthBalance />
            </Identity>
            <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
              Wallet
            </WalletDropdownLink>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>
    );
  }

  return (
    <WalletClientContext.Provider value={{ walletClient: walletClient, publicClient: publicClient as PublicClient, address: address ?? '0x' }}>
      {renderTopBar()}
      {children}
    </WalletClientContext.Provider>
  );
}