import React, { useState, useEffect, useRef } from 'react'
import { useRpcProvider } from './byorpc'
import { Address, isAddress, getContract } from 'viem'
import { ERC20_ABI, USDC_ADDRESS } from './constants'

const ContractList = ({ contracts, onSelectContract, onImport, onDeploy, onRemove }: { contracts: Address[], onSelectContract: (address: Address) => void, onImport: () => void, onDeploy: () => void, onRemove: (address: Address) => void }) => {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  const startLongPress = (contract: Address) => {
    longPressTimer.current = setTimeout(() => {
      if (window.confirm(`Are you sure you want to remove contract ${contract}?`)) {
        onRemove(contract)
      }
    }, 800)
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

  return (
    <div style={{ width: '200px', overflowY: 'auto', borderRight: '1px solid #ddd', padding: '10px' }}>
      {contracts.map((contract) => (
        <div
          key={contract}
          style={{ padding: '10px', border: '1px solid #ddd', marginBottom: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onMouseDown={() => startLongPress(contract)}
          onMouseUp={endLongPress}
          onMouseLeave={endLongPress}
          onTouchStart={() => startLongPress(contract)}
          onTouchEnd={endLongPress}
        >
          <span onClick={() => onSelectContract(contract)}>{contract}</span>
          <button onClick={() => onRemove(contract)}>Remove</button>
        </div>
      ))}
      <div style={{ padding: '10px', border: '1px solid #ddd', marginTop: '10px', cursor: 'pointer' }} onClick={onImport}>
        Import
      </div>
      <div style={{ padding: '10px', border: '1px solid #ddd', marginTop: '10px', cursor: 'pointer' }} onClick={onDeploy}>
        Deploy
      </div>
    </div>
  )
}

const ImportContract = ({ onAddContract }: { onAddContract: (address: Address) => void }) => {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleAdd = () => {
    if (isAddress(input)) {
      onAddContract(input)
      setInput('')
      setError('')
    } else {
      setError('Invalid address')
    }
  }

  return (
    <div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter contract address"
      />
      <button onClick={handleAdd}>Add</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  )
}

const MainContent = ({ selectedContract, onAddContract } : { selectedContract: Address, onAddContract: (address: Address) => void }) => {
  return (
    <div style={{ flexGrow: 1, padding: '20px' }}>
      {selectedContract !== '0x' ? (
        <div>Contract Address: {selectedContract}</div>
      ) : (
        <ImportContract onAddContract={onAddContract} />
      )}
    </div>
  )
}

const App = () => {
  const { publicClient, address, walletClient } = useRpcProvider()
  const [contracts, setContracts] = useState<Address[]>([])
  const [selectedContract, setSelectedContract] = useState<Address>('0x')
  const [error, setError] = useState('')
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0))

  useEffect(() => {
      fetchUsdcBalance()
      const unwatchTransferFrom = publicClient.watchContractEvent({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        eventName: 'Transfer',
        args: { from: address },
        onLogs: _ => fetchUsdcBalance(),
        onError: error => console.log(error)
      })

      const unwatchTransferTo = publicClient.watchContractEvent({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        eventName: 'Transfer',
        args: { to: address },
        onLogs: _ => fetchUsdcBalance(),
        onError: error => console.log(error)
      })

      return () => {
        unwatchTransferFrom()
        unwatchTransferTo()
      }
  }, [])

  const fetchUsdcBalance = async () => {
    if (!address) return
    const usdcContract = getContract({ abi: ERC20_ABI, client: publicClient, address: USDC_ADDRESS})
    const balance = await usdcContract.read.balanceOf([address]) as bigint
    setUsdcBalance(balance)
  }

  useEffect(() => {
    const storedContracts = JSON.parse(localStorage.getItem('contracts') || '[]')
    setContracts(storedContracts)
  }, [])

  useEffect(() => {
    console.log(`Selected contract: ${selectedContract}`)
  }, [selectedContract])

  useEffect(() => {
    localStorage.setItem('contracts', JSON.stringify(contracts))
    if (!contracts.includes(selectedContract)) {
      setSelectedContract('0x')
    }
  }, [contracts])

  const handleSelectContract = (contract: Address) => {
    setSelectedContract(contract)
  }

  const handleImport = () => {
    setSelectedContract('0x')
  }

  const handleDeploy = () => {
    console.log('Deploy contract')
    // Stub implementation for deploying a new contract
  }

  const handleAddContract = (newContract: Address) => {
    if (contracts.includes(newContract)) {
      setError('Contract address already exists')
      return
    }
    setContracts([...contracts, newContract])
    setError('')
  }

  const handleRemoveContract = (contractToRemove: Address) => {
    setContracts(contracts.filter(contract => contract !== contractToRemove))
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ContractList
        contracts={contracts}
        onSelectContract={handleSelectContract}
        onImport={handleImport}
        onDeploy={handleDeploy}
        onRemove={handleRemoveContract}
      />
      <MainContent
        selectedContract={selectedContract}
        onAddContract={handleAddContract}
      />
      <div>USDC: {`${usdcBalance}`}</div>
      {error && <div style={{ color: 'red', padding: '10px' }}>{error}</div>}
    </div>
  )
}

export default App
