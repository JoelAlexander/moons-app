import React, { useEffect, useState } from 'react';
import { useRpcProvider } from './byorpc';
import { Address } from 'viem';

export default function Page() {
  const { provider, walletClient, publicClient, address } = useRpcProvider()!!;

  const signMessage = async () => {
    if (!address) return
    await walletClient.signMessage({ account: address, message: 'hello-world' })
  }

  return (
    <div>
      <div>Connected: {address}</div>
      <button onClick={signMessage}>Sign Message</button>
    </div>
  )
}
