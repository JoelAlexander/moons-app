import React, { ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { base } from 'viem/chains';
import { EthereumProvider as EthereumProviderFactory } from '@walletconnect/ethereum-provider';
import { http, createPublicClient, createWalletClient, custom, type WalletClient, type PublicClient, Chain, Address } from 'viem';
import { WC_PROJECT_ID } from './constants';
import EthereumProvider from 'node_modules/@walletconnect/ethereum-provider/dist/types/EthereumProvider';

const RpcProviderContext = createContext<{
    provider: EthereumProvider,
    publicClient: PublicClient,
    walletClient: WalletClient,
    address: Address
} | null>(null);

export function useRpcProvider(): {
    provider: EthereumProvider,
    publicClient: PublicClient,
    walletClient: WalletClient,
    address: Address
} {
  return useContext(RpcProviderContext)!!;
}

export function BYORPC({ children }: { children: ReactNode | ReactNode[] }) {
  const [userPendingRpcUrl, setUserPendingRpcUrl] = useState<string>('');
  const [userSelectedRpcUrl, setUserSelectedRpcUrl] = useState<string>('');
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<Address | ''>('')
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const handleValidateRpcAndSetupClients = (rpcUrl: string | null) => {
    const usingRpcUrl = rpcUrl ? rpcUrl : base.rpcUrls.default.http[0];
    const modifiedRpcUrls = rpcUrl ? { default: { http: [rpcUrl] } } : base.rpcUrls;
    const modifiedBaseChain: Chain = { ...base, rpcUrls: modifiedRpcUrls };
    const modifiedRpcMap = { [modifiedBaseChain.id]: modifiedRpcUrls.default.http[0] };
    EthereumProviderFactory.init({
      rpcMap: modifiedRpcMap,
      chains: [base.id],
      projectId: WC_PROJECT_ID,
      showQrModal: true,
    }).then(provider => {
      const wc = createWalletClient({
        chain: modifiedBaseChain,
        transport: custom(provider),
      })

      const pc = createPublicClient({
        chain: modifiedBaseChain,
        transport: http()
      })

      return Promise.all([
        pc.getBlockNumber(),
        pc.getChainId()
      ]).then(([blockNumber, chainId]) => {
        console.log(`Chain ID: ${chainId} Block Number: ${blockNumber}`)
        if (chainId !== base.id) {
          console.log(`Unexpected chainId from RPC: ${chainId}`)
          setError(`RPC did not match expected chain ID for ${modifiedBaseChain.name}: ${modifiedBaseChain.id}`)
          handleStopEditing()
        } else {
          setError('')
          setUserSelectedRpcUrl(usingRpcUrl)
          setProvider(provider)
          setWalletClient(wc)
          setPublicClient(pc)
          handleStopEditing()
        }
      })
    }).catch(e => {
      setError(`${e}`)
      handleStopEditing()
    })
  }

  useEffect(() => handleValidateRpcAndSetupClients(null), [])

  const handleRpcSubmit = async () => {
    if (userPendingRpcUrl) {
      handleValidateRpcAndSetupClients(userPendingRpcUrl);
    }
  }

  const handleStartEditing = (initialEntry: string) => {
    setIsEditing(true)
    setUserPendingRpcUrl(initialEntry)
    setError('')
  }

  const handleStopEditing = () => {
    setIsEditing(false)
    setUserPendingRpcUrl('')
  }

  const connect = async () => {
    if (!provider) return
    console.log("Connecting!")
    await provider.connect().then(() => {
      if (!walletClient) return
      return walletClient.getAddresses().then(([first, ..._]) => {
        setAddress(first)
        console.log(`Connected to wallet ${first}`)
      })
    })
  }

  const disconnect = async () => {
    if (!provider) return
    console.log("Disconnecting!")
    await provider.disconnect().then(() => {
      setAddress('')
      console.log("Disconnected!")
    })
  }

  const renderTopBar = () => (
    <div className="top-bar">
      <div className="network">🌐 {base.name}</div>
      <div className="rpc">
        {!isEditing &&
          <span onClick={() => handleStartEditing(userSelectedRpcUrl)}>{userSelectedRpcUrl.split('/')[2]}</span>
        }
      </div>
      {isEditing && (
        <div className="edit-rpc">
          <input type="text" value={userPendingRpcUrl} onChange={(e) => setUserPendingRpcUrl(e.target.value)} />
          <button onClick={handleRpcSubmit} disabled={error !== ''} >Submit</button>
          <button onClick={handleStopEditing}>Cancel</button>
        </div>
      )}
      {(!address && provider && !provider.connecting) && <button onClick={connect}>Connect Wallet</button>}
      {address && <button onClick={disconnect}>Disconnect Wallet</button>}
      {error && <div className="error">{error}</div>}
    </div>
  );

  if (!provider || !walletClient || !publicClient || !address) {
    return (
      <>
        {renderTopBar()}
        <div className="message">Connect to a network and wallet to continue</div>
      </>
    );
  }

  return (
    <RpcProviderContext.Provider value={{ provider: provider!!, walletClient: walletClient!!, publicClient: publicClient!!, address }}>
      {renderTopBar()}
      {children}
    </RpcProviderContext.Provider>
  );
}