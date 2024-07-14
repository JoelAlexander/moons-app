import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import { Loader } from './loader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, createPublicClient, createWalletClient, custom, type WalletClient, type PublicClient, Chain, Address } from 'viem';
import { base } from 'wagmi/chains';
import { createConfig, WagmiProvider } from 'wagmi';
import './index.css';
import { coinbaseWallet } from 'wagmi/connectors';

const queryClient = new QueryClient()
const coinbaseWalletConnector = coinbaseWallet({ appName: 'Moons Protocol' })
const config = createConfig({
    chains: [ base ],
    transports: {
        [base.id]: http(base.rpcUrls.default.http[0])
    },
    connectors: [coinbaseWalletConnector]
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
