'use client';
import { ConnectAccount } from '@coinbase/onchainkit/wallet';
import { ReactNode, useEffect } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base as baseViem, baseSepolia as baseSepoliaViem } from 'viem/chains';
import { WagmiProvider, useWalletClient, useSwitchChain } from 'wagmi';
import { NEXT_PUBLIC_CDP_API_KEY } from '../config';
import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { MOONS_ABI, MOONS_BYTECODE } from './moons';

const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  multiInjectedProviderDiscovery: false,
  connectors: [
    coinbaseWallet({
      appName: 'moons-app',
      preference: 'all',
      version: '4',
    }),
  ],
  ssr: true,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

const queryClient = new QueryClient();

const DeployMoons = () => {
  const { chains, switchChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: baseSepolia.id })

  useEffect(() => {
    switchChain({ chainId: baseSepolia.id })
  }, [ walletClient ])

  return <>
    <p>Deploy moons component</p>
    <button onClick={() => {
      walletClient?.deployContract({ abi: MOONS_ABI, args: [604800], bytecode: MOONS_BYTECODE})
    }}><p>Press here to deploy.</p></button>
  </>
}

export default function Page() {

  return <>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <OnchainKitProvider
            apiKey={NEXT_PUBLIC_CDP_API_KEY}
            chain={baseSepoliaViem}
          >
            <DeployMoons/>
            <ConnectAccount />
          </OnchainKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
  </>;
}
