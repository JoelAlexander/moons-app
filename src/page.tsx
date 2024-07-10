import React from 'react';
import { BYORPC, useRpcProvider } from './byorpc';

export default function Page() {
  const { provider, client } = useRpcProvider()!!;

  const connect = async () => {
    await provider?.connect();
  };

  const signMessage = async () => {
    const account = client?.account;
    if (!account || !account.signMessage) return;
    await account!!.signMessage!!({
      message: 'hello world'
    });
  };

  if (!client?.account) {
    return (
      <button onClick={connect}>Connect Wallet</button>
    );
  }

  return (
    <div>
      <div>Connected: {client?.account?.address}</div>
      <button onClick={signMessage}>Sign Message</button>
    </div>
  );
}
