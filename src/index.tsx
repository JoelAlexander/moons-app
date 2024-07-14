import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import { Loader } from './loader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, createPublicClient, createWalletClient, custom, type WalletClient, type PublicClient, Chain, Address } from 'viem';
import { base } from 'wagmi/chains';
import { createConfig, WagmiProvider } from 'wagmi';
import './index.css';
import { coinbaseWallet, walletConnect } from 'wagmi/connectors';

const queryClient = new QueryClient()

const coinbaseWalletConnector =
    coinbaseWallet({ appName: 'Moons Protocol', version: '3', chainId: base.id })

const walletConnectConnector =
    walletConnect({ projectId: '4f0f56872ba068cb3260c517ff17a48e' })

const config = createConfig({
    chains: [ base ],
    transports: {
        [base.id]: http(base.rpcUrls.default.http[0])
    },
    connectors: [coinbaseWalletConnector, walletConnectConnector],
    
  })
  
declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}

const container = document.getElementById('app');
const root = createRoot(container!!);
root.render(
<WagmiProvider config={config}>
<QueryClientProvider client={queryClient}>
<Loader><App /></Loader>
</QueryClientProvider>
</WagmiProvider>
);
