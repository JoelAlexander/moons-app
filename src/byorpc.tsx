import React, { ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { base } from 'viem/chains';
import { EthereumProvider as EthereumProviderFactory } from '@walletconnect/ethereum-provider';
import { http, createPublicClient, createWalletClient, custom, type WalletClient, type PublicClient } from 'viem';
import { WC_PROJECT_ID } from './constants';
import EthereumProvider from 'node_modules/@walletconnect/ethereum-provider/dist/types/EthereumProvider';

const RpcProviderContext = createContext<{
    provider: EthereumProvider,
    publicClient: PublicClient,
    walletClient: WalletClient
} | null>(null);

export function useRpcProvider(): {
    provider: EthereumProvider,
    publicClient: PublicClient,
    walletClient: WalletClient
} {
  return useContext(RpcProviderContext)!!;
}

export function BYORPC({ children } : { children: ReactNode | ReactNode[]}) {
  const [rpcUrl, setRpcUrl] = useState('');
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [error, setError] = useState<string>('');

  const handleRpcSubmit = async () => {
    try {
      const provider = await EthereumProviderFactory.init({
        rpcMap: { [base.id]: rpcUrl },
        chains: [base.id],
        projectId: WC_PROJECT_ID,
        showQrModal: false, // Disable QR modal for validation
      });

      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain: base,
        transport: http()
      });

      const blockNumber = await publicClient.getBlockNumber();
      const chainId = await publicClient.getChainId();
      console.log(`Chain ID: ${chainId} Block Number: ${blockNumber}`)
      if (chainId !== base.id) {
        console.log(`Unexpected chainId from RPC: ${chainId}`)
      } else {
        setProvider(provider);
        setWalletClient(walletClient);
        setPublicClient(publicClient);
        setError('');
      }
    } catch (e: any) {
      setError(`${e.message}`);
    }
  };

  if (!provider || !walletClient || !publicClient) {
    return (
      <div style={{ textAlign: 'center', marginTop: '20%' }}>
        <label>
          Enter Base RPC URL:
          <input type="text" value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} />
        </label>
        <button onClick={handleRpcSubmit}>Submit RPC URL</button>
        {error.length > 0 && <div style={{ color: 'red' }}>{error}</div>}
      </div>
    );
  }

  return (
    <RpcProviderContext.Provider value={{ provider: provider!!, walletClient: walletClient!!, publicClient: publicClient!! }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f0f0f0' }}>
          <div>Network: Base</div>
          <div>RPC: {rpcUrl}</div>
        </div>
        {children}
      </div>
    </RpcProviderContext.Provider>
  );
}
