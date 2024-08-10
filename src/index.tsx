import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import { Loader } from './loader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { base } from 'wagmi/chains';
import { createConfig, WagmiProvider } from 'wagmi';
import './index.css';
import { coinbaseWallet, walletConnect } from 'wagmi/connectors';

const queryClient = new QueryClient()

const coinbaseWalletConnector =
    coinbaseWallet({ appName: 'Moons Protocol', version: '4', chainId: base.id })

const walletConnectConnector =
    walletConnect({ projectId: '4f0f56872ba068cb3260c517ff17a48e' })

console.log(import.meta.env.VITE_BASE_NODE);

const config = createConfig({
    chains: [ base ],
    transports: {
        [base.id]: http(import.meta.env.VITE_BASE_NODE)
    },
    connectors: [coinbaseWalletConnector, walletConnectConnector]
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
