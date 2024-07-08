import { ReactNode, useState, useEffect } from 'react';
import { base } from 'viem/chains';
import { MOONS_ABI, MOONS_BYTECODE } from './moons';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { type Address, createWalletClient, custom } from 'viem';

const projectId = '4f0f56872ba068cb3260c517ff17a48e';

const provider = await EthereumProvider.init({
  rpcMap: { [base.id]: `https://api.developer.coinbase.com/rpc/v1/base/Nx5XG01kOYAO0VgHbSHHuYAHYrzlzceu`},
  chains: [1],
  projectId,
  showQrModal: true,
});

const walletClient = createWalletClient({
  chain: base,
  transport: custom(provider),
});

export default function Page() {
  const [account, setAccount] = useState<Address>();

  const connect = async () => {
    await provider.connect();
    const [address] = await walletClient.getAddresses();
    setAccount(address);
  };

  const signMessage = async () => {
    if (!account) return;
    await walletClient.signMessage({
      account,
      message: 'hello world',
    });
  };

  if (account)
    return (
      <>
        <div>Connected: {account}</div>
        <button onClick={signMessage}>Sign Message</button>
      </>
    );
  return <button onClick={connect}>Connect Wallet</button>;
}
