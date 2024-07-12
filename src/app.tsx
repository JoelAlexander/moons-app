import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRpcProvider } from './byorpc'
import { QRCodeSVG } from 'qrcode.react'
import { Address, isAddress, getContract, encodeDeployData, Log } from 'viem'
import { ERC20_ABI, USDC_ADDRESS } from './constants'
import { MOONS_ABI, MOONS_BYTECODE } from './moons'
import { base } from 'viem/chains'

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

const ImportMoons = ({ onAddContract }: { onAddContract: (address: Address) => void }) => {
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

const Moons = ({ selectedContract } : { selectedContract: Address }) => {
  const { publicClient, address, walletClient } = useRpcProvider()
  const [userUsdcBalance, setUserUsdcBalance] = useState<bigint>(BigInt(0))
  const [contractUsdcBalance, setContractUsdcBalance] = useState<bigint>(BigInt(0))
  const [admins, setAdmins] = useState<Address[]>([])
  const [participants, setParticipants] = useState<Address[]>([])
  const [currentCycle, setCurrentCycle] = useState<bigint>(BigInt(0))
  const [maximumAllowedDisbursement, setMaximumAllowedDisbursement] = useState<bigint>(BigInt(0))
  const [eventFeed, setEventFeed] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [disbursementValue, setDisbursementValue] = useState<string>('')
  const [adminAddress, setAdminAddress] = useState<string>('')
  const [participantAddress, setParticipantAddress] = useState<string>('')

  const usdcContract = useMemo(() => getContract({ abi: ERC20_ABI, client: { public: publicClient }, address: USDC_ADDRESS }), [])
  const moonsContract = useMemo(() => getContract({ abi: MOONS_ABI, client: { public: publicClient }, address: selectedContract }), [])

  const fetchUserUsdcBalance = () => {
    usdcContract.read.balanceOf([address]).then(balance => setUserUsdcBalance(balance as bigint))
  }

  const fetchMoonsUsdcBalance = () => {
    usdcContract.read.balanceOf([selectedContract]).then(balance => setContractUsdcBalance(balance as bigint))
  }

  const fetchAdmins = () => {
    moonsContract.read.getAdmins().then(adminsResponse => {
      const [admins, ranks]: [Address[], BigInt[]] = (adminsResponse as [Address[], BigInt[]])
      setAdmins(admins)
      setIsAdmin(admins.includes(address))
    })
  }

  const fetchParticipants = () => {
    moonsContract.read.getParticipants().then(participantResponse => {
      const [participants, ranks]: [Address[], BigInt[]] = (participantResponse as [Address[], BigInt[]])
      setParticipants(participants)
    })
  }

  const fetchCurrentCycle = () => {
    moonsContract.read.getCurrentCycle().then(cycle => setCurrentCycle(cycle as bigint))
  }

  const fetchMaximumAllowedDisbursement = () => {
    publicClient.readContract({
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'getMaximumAllowedDisbursement',
      args: [USDC_ADDRESS]
    }).then(value => setMaximumAllowedDisbursement(value as bigint))
  }

  const disburseFunds = () => {
    walletClient.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'disburseFunds',
      args: [USDC_ADDRESS, BigInt(disbursementValue), '']
    }).then(_ => {
      fetchMoonsUsdcBalance()
      fetchUserUsdcBalance()
    })
  }

  const addAdmin = () => {
    walletClient.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'addAdmin',
      args: [adminAddress, 'Welcome to our new admin.']
    }).then(_ => {
      fetchAdmins()
    })
  }

  const addParticipant = () => {
    walletClient.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'addParticipant',
      args: [participantAddress, 'Welcome to our new participant.']
    }).then(_ => {
      fetchParticipants()
    })
  }

  const handleEvent = (eventType: string, log: Log) => {
    setEventFeed(prevFeed => [`${eventType}\n${JSON.stringify(log["args"], (_, value) =>
      typeof value === 'bigint'
          ? value.toString()
          : value
    )}`, ...prevFeed])
  }

  useEffect(() => {
    const fetchData = () => {
      fetchUserUsdcBalance()
      fetchMoonsUsdcBalance()
      fetchAdmins()
      fetchParticipants()
      fetchCurrentCycle()
      fetchMaximumAllowedDisbursement()
    }

    fetchData()
    
    const interval = setInterval(fetchData, 15000)

    const unwatchAdminAdded = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'AdminAdded',
      onLogs: logs => {
        fetchAdmins()
        logs.forEach(log => handleEvent('AdminAdded', log))
      }
    })

    const unwatchAdminRemoved = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'AdminRemoved',
      onLogs: logs => {
        fetchAdmins()
        logs.forEach(log => handleEvent('AdminRemoved', log))
      }
    })

    const unwatchParticipantAdded = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'ParticipantAdded',
      onLogs: logs => {
        fetchParticipants()
        logs.forEach(log => handleEvent('ParticipantAdded', log))
      }
    })

    const unwatchParticipantRemoved = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'ParticipantRemoved',
      onLogs: logs => {
        fetchParticipants()
        logs.forEach(log => handleEvent('ParticipantRemoved', log))
      }
    })

    const unwatchTransferToMoons = publicClient.watchContractEvent({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: { to: selectedContract },
      onLogs: logs => {
        fetchMoonsUsdcBalance()
        logs.forEach(log => handleEvent('FundsAdded', log))
      }
    })

    const unwatchFundsDisbursed = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'FundsDisbursed',
      onLogs: logs => {
        fetchMoonsUsdcBalance()
        logs.forEach(log => handleEvent('FundsDisbursed', log))
      }
    })

    const unwatchTransferFromUser = publicClient.watchContractEvent({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: { from: address },
      onLogs: _ => fetchUserUsdcBalance()
    })

    const unwatchTransferToUser = publicClient.watchContractEvent({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: { to: address },
      onLogs: _ => fetchUserUsdcBalance()
    })

    return () => {
      // Clear interval on unmount
      clearInterval(interval)

      // Generic user sync
      unwatchTransferFromUser()
      unwatchTransferToUser()

      // Contract specific actions
      unwatchAdminAdded()
      unwatchAdminRemoved()
      unwatchParticipantAdded()
      unwatchParticipantRemoved()
      unwatchTransferToMoons()
      unwatchFundsDisbursed()
    }
}, [])

  return (
    <>
      <div>
        <QRCodeSVG value={selectedContract} />
      </div>
      <div>Contract Address: {selectedContract}</div>
      <div>Moons USDC: {`${contractUsdcBalance}`}</div>
      <div>User USDC: {`${userUsdcBalance}`}</div>
      <div>Current Cycle: {`${currentCycle}`}</div>
      <div>Maximum Allowed Disbursement: {`${maximumAllowedDisbursement}`}</div>

      {isAdmin && (
        <>
          <div>
            <input
              type="text"
              placeholder="Admin Address"
              value={adminAddress}
              onChange={(e) => setAdminAddress(e.target.value)}
            />
            <button onClick={addAdmin}>Add Admin</button>
          </div>
          <div>
            <input
              type="text"
              placeholder="Participant Address"
              value={participantAddress}
              onChange={(e) => setParticipantAddress(e.target.value)}
            />
            <button onClick={addParticipant}>Add Participant</button>
          </div>
        </>
      )}

      <div>
        <input
          type="text"
          placeholder="Disbursement Value"
          value={disbursementValue}
          onChange={(e) => setDisbursementValue(e.target.value)}
        />
        <button onClick={disburseFunds}>Disburse Funds</button>
     </div>

      {/* <div>
        <h3>Event Feed:</h3>
        <ul>
          {eventFeed.map((event, index) => (
            <li key={index}>{event}</li>
          ))}
        </ul>
      </div> */}
    </>
  )
}

const App = () => {
  const { publicClient, address, walletClient } = useRpcProvider()
  const [contracts, setContracts] = useState<Address[]>([])
  const [selectedContract, setSelectedContract] = useState<Address>('0x')
  const [error, setError] = useState('')

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

  const handleDeploy = async () => {
    if (window.confirm(`Are you sure you want to deploy a new Moons contract?`)) {
      const data = encodeDeployData({ abi: MOONS_ABI, bytecode: MOONS_BYTECODE, args: [604800]})
      const gasLimit = await publicClient.estimateGas({
        account: address,
        data: data
      })
      console.log(`Gas estimate: ${gasLimit}`)
      await walletClient.deployContract({ gas: gasLimit, abi: MOONS_ABI, bytecode: MOONS_BYTECODE, args: [604800], account: address, chain: base });
    }
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

  const mainContent = selectedContract !== '0x' ?
    <Moons selectedContract={selectedContract} /> : <ImportMoons onAddContract={handleAddContract}/>

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ContractList
        contracts={contracts}
        onSelectContract={handleSelectContract}
        onImport={handleImport}
        onDeploy={handleDeploy}
        onRemove={handleRemoveContract}
      />
      <div style={{ flexGrow: 1, padding: '20px' }}>
        {mainContent}
      </div>
      {error && <div style={{ color: 'red', padding: '10px' }}>{error}</div>}
    </div>
  )
}

export default App
