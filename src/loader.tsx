import React, { ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { base } from 'viem/chains';
import { EthereumProvider as EthereumProviderFactory } from '@walletconnect/ethereum-provider';
import { http, createPublicClient, createWalletClient, custom, type WalletClient, type PublicClient, Chain, Address } from 'viem';
import { WC_PROJECT_ID } from './constants';
import EthereumProvider from 'node_modules/@walletconnect/ethereum-provider/dist/types/EthereumProvider';
import { createConfig, useAccount, useChainId, useChains, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWalletClient, WagmiProvider } from 'wagmi';
import { base as baseWagmi } from 'wagmi/chains';
import { Config } from 'wagmi';

const RpcProviderContext = createContext<{
    publicClient: PublicClient,
    walletClient: WalletClient,
    address: Address
} | null>(null);

export function useRpcProvider(): {
    publicClient: PublicClient,
    walletClient: WalletClient,
    address: Address
} {
  return useContext(RpcProviderContext)!!;
}

export function Loader({ children }: { children: ReactNode | ReactNode[] }) {
  const { connect: connectWallet, connectors } = useConnect()
  const { disconnect: disconnectWallet } = useDisconnect()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const { chains, switchChain } = useSwitchChain()

  const verifySwitchedToChain = () => {
    walletClient?.getChainId()
    .then((chainId) => {
      console.log(`ChainID: ${chainId}`);
      if (chainId !== baseWagmi.id) {
        console.log(`Switching to ${baseWagmi.id}`)
        switchChain({ chainId: base.id })
      }
    })
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      verifySwitchedToChain()
    }, 3000);
    return () => clearInterval(intervalId);
  }, [walletClient]);

  //const [userPendingRpcUrl, setUserPendingRpcUrl] = useState<string>('');
  //const [userSelectedRpcUrl, setUserSelectedRpcUrl] = useState<string>('');
  //const [provider, setProvider] = useState<EthereumProvider | null>(null);
  //const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  //const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  //const [address, setAddress] = useState<Address | ''>('')
  //const [error, setError] = useState<string>('');
  //const [isEditing, setIsEditing] = useState(false);

  // const handleValidateRpcAndSetupClients = (rpcUrl: string | null) => {
  //   const usingRpcUrl = rpcUrl ? rpcUrl : base.rpcUrls.default.http[0];
  //   const modifiedRpcUrls = rpcUrl ? { default: { http: [rpcUrl] } } : base.rpcUrls;
  //   const modifiedBaseChain: Chain = { ...base, rpcUrls: modifiedRpcUrls };
  //   const modifiedRpcMap = { [modifiedBaseChain.id]: modifiedRpcUrls.default.http[0] };
  //   EthereumProviderFactory.init({
  //     rpcMap: modifiedRpcMap,
  //     chains: [base.id],
  //     projectId: WC_PROJECT_ID,
  //     showQrModal: true,
  //   }).then(provider => {
  //     const wc = createWalletClient({
  //       chain: modifiedBaseChain,
  //       transport: custom(provider),
  //     })

  //     const pc = createPublicClient({
  //       chain: modifiedBaseChain,
  //       transport: http()
  //     })

  //     return Promise.all([
  //       pc.getBlockNumber(),
  //       pc.getChainId()
  //     ]).then(([blockNumber, chainId]) => {
  //       console.log(`Chain ID: ${chainId} Block Number: ${blockNumber}`)
  //       if (chainId !== base.id) {
  //         console.log(`Unexpected chainId from RPC: ${chainId}`)
  //         setError(`RPC did not match expected chain ID for ${modifiedBaseChain.name}: ${modifiedBaseChain.id}`)
  //         handleStopEditing()
  //       } else {
  //         setError('')
  //         setUserSelectedRpcUrl(usingRpcUrl)
  //         setProvider(provider)
  //         setWalletClient(wc)
  //         setPublicClient(pc)
  //         handleStopEditing()
  //       }
  //     })
  //   }).catch(e => {
  //     setError(`${e}`)
  //     handleStopEditing()
  //   })
  // }

  // useEffect(() => handleValidateRpcAndSetupClients(null), [])

  // const handleRpcSubmit = async () => {
  //   if (userPendingRpcUrl) {
  //     handleValidateRpcAndSetupClients(userPendingRpcUrl);
  //   }
  // }

  // const handleStartEditing = (initialEntry: string) => {
  //   setIsEditing(true)
  //   setUserPendingRpcUrl(initialEntry)
  //   setError('')
  // }

  // const handleStopEditing = () => {
  //   setIsEditing(false)
  //   setUserPendingRpcUrl('')
  // }

  const connect = async () => {
    // if (!provider) return
    // console.log("Connecting!")
    // await provider.connect().then(() => {
    //   if (!walletClient) return
    //   return walletClient.getAddresses().then(([first, ..._]) => {
    //     setAddress(first)
    //     console.log(`Connected to wallet ${first}`)
    //   })
    // })
    connectWallet({chainId: baseWagmi.id, connector: connectors[0]})
  }

  const disconnect = async () => {
    // if (!provider) return
    // console.log("Disconnecting!")
    // await provider.disconnect().then(() => {
    //   setAddress('')
    //   console.log("Disconnected!")
    // })
    disconnectWallet({connector: connectors[0]})
  }

  const renderTopBar = () => (
    <div className="top-bar">
      {/* <div className="network">🌐 {base.name}</div>
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
      )} */}
      {(!address) && <button onClick={connect}>Connect Wallet</button>}
      {address && <button onClick={disconnect}>Disconnect Wallet</button>}
      {address && <p>{address}</p>}
    </div>
  );

  if (!walletClient || !publicClient || !address) {
    return (
      <>
        {renderTopBar()}
        <div className="message">Connect to a network and wallet to continue</div>
      </>
    );
  }

  return (
    <RpcProviderContext.Provider value={{ walletClient: walletClient!!, publicClient: publicClient!! as PublicClient, address }}>
      {renderTopBar()}
      {children}
    </RpcProviderContext.Provider>
  );
}