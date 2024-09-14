import React, { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import { Loader } from './loader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Chain, http } from 'viem';
import { base } from 'wagmi/chains';
import { createConfig, WagmiProvider } from 'wagmi';
import '@coinbase/onchainkit/styles.css';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  metaMaskWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets';

coinbaseWallet.preference = 'all'

const queryClient = new QueryClient()

// **Set up connectors with the custom wallet**
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended Wallet',
      wallets: [coinbaseWallet],
    },
    {
      groupName: 'Other Wallets',
      wallets: [
        walletConnectWallet,
        metaMaskWallet
      ],
    }
  ],
  {
    appName: 'moons',
    projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    walletConnectParameters: {},
    appDescription: '',
    appUrl: import.meta.env.VITE_APP_URL,
    appIcon: '',
  },
);

const config = createConfig({
    chains: [ base ],
    transports: {
        [base.id]: http(import.meta.env.VITE_BASE_NODE)
    },
    connectors: connectors,
    multiInjectedProviderDiscovery: false
  })
  
declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}

type Props = { children: ReactNode };

function OnchainProviders({ children }: Props) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={import.meta.env.VITE_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
        >
          <RainbowKitProvider initialChain={base} modalSize='compact'>
            {children}
          </RainbowKitProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider> 
  );
}

const container = document.getElementById('app');

if (!container) {
  throw new Error("Failed to find the root element with id 'app'.");
}

const root = createRoot(container);
root.render(
<OnchainProviders>
<Loader><App /></Loader>
</OnchainProviders>
);
