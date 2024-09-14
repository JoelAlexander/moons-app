import React, { useEffect, useRef, useState } from 'react'
import { Address, isAddress } from 'viem'
import { useWalletClientContext } from './loader'
import { MOONS_ABI } from './moons'

type ContractListProps = {
  contracts: Address[]
  loggedIn: boolean
  onSelectContract: (address: Address) => void
  onImport: () => void
  onDeploy: () => void
  onRemove: (address: Address) => void
  onAbout: () => void
}

export const ContractList: React.FC<ContractListProps> = ({ contracts, loggedIn, onSelectContract, onDeploy, onRemove, onAbout }) => {
  const { publicClient } = useWalletClientContext()
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const [ contractNames, setContractNames ] = useState<{[key: Address]: string}>({})

  useEffect(() => {
    Promise.all(contracts.map((c: Address) => {
      return publicClient.readContract({
        abi: MOONS_ABI,
        address: c,
        functionName: 'name'
      }).then(n => {
        return [c, n as string]
      })
    })).then(es => setContractNames(Object.fromEntries(es as [Address, string][])))
  }, [contracts])

  const startLongPress = (contract: Address) => {
    longPressTimer.current = setTimeout(() => {
      if (window.confirm(`Are you sure you want to remove contract ${contract}?`)) {
        onRemove(contract)
      }
    }, 3000)
  }

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  const abrev = (addr: Address) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div style={{ overflowX: 'auto', display: 'flex', flexDirection: 'row', borderBottom: '1px solid #ddd', cursor: 'grab' }}>
      {contracts.map((contract, i) => (
        <div
          key={contract}
          style={{ marginLeft: i == 0 ? '1rem' : '0.5rem', whiteSpace: 'nowrap', marginRight: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #ddd', cursor: 'pointer' }}
          onMouseDown={() => startLongPress(contract)}
          onMouseUp={endLongPress}
          onMouseLeave={endLongPress}
          onTouchStart={() => startLongPress(contract)}
          onTouchEnd={endLongPress}
          onClick={() => onSelectContract(contract)}
        >
          <h4 style={{ fontFamily: 'monospace', margin: '0', fontSize: '0.8rem' }}>{contractNames[contract] ? contractNames[contract] : abrev(contract)}</h4>
        </div>
      ))}
      {loggedIn && <div style={{ margin: '0.5rem', padding: '0.5rem', cursor: 'pointer', minWidth: "96px" }} onClick={onDeploy}>
        <h4 style={{ fontFamily: 'monospace', margin: '0', fontSize: '0.8rem' }}>🚀  Deploy  🌑</h4>
      </div>}
      <div style={{ margin: '0.5rem', padding: '0.5rem', cursor: 'pointer', minWidth: "96px" }} onClick={onAbout}>
        <h4 style={{ fontFamily: 'monospace', margin: '0', fontSize: '0.8rem' }}>ℹ️  About  ❔</h4>
      </div>
    </div>
  )
}

export default ContractList