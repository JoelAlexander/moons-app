import React, { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react'
import { useWalletClientContext } from './loader'
import { QRCodeSVG } from 'qrcode.react'
import { Address, isAddress, getContract, encodeDeployData, Log, Client, getAddress } from 'viem'
import { ERC20_ABI, USDC_ADDRESS } from './constants'
import { MOONS_ABI, MOONS_BYTECODE } from './moons'
import { base } from 'viem/chains'
import SineWave from './sine'
import { usePublicClient } from 'wagmi'
import { AddressBubble, getColorFromAddress } from './util'

function formatUSDC(amount: bigint): string {
  const usdcDecimals = 6n; // USDC has 6 decimal places
  const factor = 10n ** usdcDecimals;
  const integerPart = amount / factor;
  const fractionalPart = amount % factor;

  const fractionalString = fractionalPart.toString().padStart(Number(usdcDecimals), '0').slice(0, 2);
  return `${integerPart.toString()}.${fractionalString}`;
}

const ContractList = ({ contracts, onSelectContract, onImport, onDeploy, onRemove }: { contracts: Address[], onSelectContract: (address: Address) => void, onImport: () => void, onDeploy: () => void, onRemove: (address: Address) => void }) => {
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

  const abrev = (addr: Address) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

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
          <span onClick={() => onSelectContract(contract)}>{contractNames[contract] ? contractNames[contract] : abrev(contract)}</span>
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

function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  const length = Math.min(arr1.length, arr2.length);
  const result: [T, U][] = [];

  for (let i = 0; i < length; i++) {
      result.push([arr1[i], arr2[i]]);
  }

  return result;
}

function getSortedAddressesByRank(obj: {[key: Address]: BigInt}): Address[] {
  return Object.keys(obj).sort((a, b) => {
      const bigIntA: BigInt = obj[a as Address];
      const bigIntB: BigInt = obj[b as Address];
      if (bigIntA < bigIntB) return -1;
      if (bigIntA > bigIntB) return 1;
      return 0;
  }) as Address[];
}

const Moons = ({ selectedContract } : { selectedContract: Address }) => {
  const { address, publicClient, walletClient } = useWalletClientContext()
  const [moonsName, setMoonsName] = useState('')
  const [moonsConstitution, setMoonsConstitution] = useState('')
  const [userUsdcBalance, setUserUsdcBalance] = useState<bigint>(BigInt(0))
  const [contractUsdcBalance, setContractUsdcBalance] = useState<bigint>(BigInt(0))
  const [admins, setAdmins] = useState<{[key: Address]: BigInt}>({})
  const [participants, setParticipants] = useState<{[key: Address]: bigint}>({})
  const [maximumAllowedDisbursement, setMaximumAllowedDisbursement] = useState<bigint>(BigInt(0))
  const [eventFeed, setEventFeed] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [disbursementValue, setDisbursementValue] = useState<string>('')
  const [adminAddress, setAdminAddress] = useState<string>('')
  const [participantAddress, setParticipantAddress] = useState<string>('')
  const [startTime, setStartTime] = useState<bigint>(0n)
  const [cycleTime, setCycleTime] = useState<bigint>(0n)
  const [nextAllowedDisburseTime, setNextAllowedDisburseTime] = useState(BigInt(0))
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showDisbursementInput, setShowDisbursementInput] = useState(false)
  const [showKnockInput, setShowKnockInput] = useState(false)
  const [knockMemo, setKnockMemo] = useState('')
  const [disbursmentError, setDisbursmentError] = useState('');

  const usdcContract = useMemo(() => getContract({ abi: ERC20_ABI, client: { public: publicClient }, address: USDC_ADDRESS }), [])
  const moonsContract = useMemo(() => getContract({ abi: MOONS_ABI, client: { public: publicClient }, address: selectedContract }), [])

  const fetchName = () => {
    moonsContract.read.name().then(name => setMoonsName(name as string))
  }

  const fetchConstitution = () => {
    moonsContract.read.constitution().then(constitution => setMoonsConstitution(constitution as string))
  }

  const fetchStartTime = () => {
    moonsContract.read.startTime().then(startTime => {
      setStartTime(startTime as bigint)
    })
  }

  const fetchCycleTime = () => {
    moonsContract.read.cycleTime().then(cycleTime => {
      setCycleTime(cycleTime as bigint)
    })
  }

  const fetchUserUsdcBalance = () => {
    usdcContract.read.balanceOf([address]).then(balance => setUserUsdcBalance(balance as bigint))
  }

  const fetchMoonsUsdcBalance = () => {
    usdcContract.read.balanceOf([selectedContract]).then(balance => setContractUsdcBalance(balance as bigint))
  }

  const fetchAdmins = () => {
    moonsContract.read.getAdmins().then(adminsResponse => {
      const [admins, ranks]: [Address[], BigInt[]] = (adminsResponse as [Address[], bigint[]])
      setAdmins(Object.fromEntries(zip(admins, ranks)))
      setIsAdmin(admins.includes(address || '0x'))
    })
  }

  const fetchParticipants = () => {
    moonsContract.read.getParticipants().then(participantResponse => {
      const [participants, ranks]: [Address[], bigint[]] = (participantResponse as [Address[], bigint[]])
      setParticipants(Object.fromEntries(zip(participants, ranks)))
    })
  }

  const fetchNextAllowedDisburseTime = () => {
    moonsContract.read.getNextAllowedDisburseTime([address]).then(time => {
      setNextAllowedDisburseTime(time as bigint)
    })
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

  const handleDisbursementChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setDisbursementValue(value);
      if (BigInt(parseFloat(value) * 1e6) > maximumAllowedDisbursement) {
        setDisbursmentError(`Value must be less than ${formatUSDC(maximumAllowedDisbursement)}`);
      } else {
        setDisbursmentError('');
      }
    }
  };

  const disburseFunds = () => {
    const valueInMicroUSDC = BigInt(Math.round(parseFloat(disbursementValue) * 1e6));
    walletClient.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'disburseFunds',
      args: [USDC_ADDRESS, valueInMicroUSDC, '']
    }).then(_ => {
      fetchMoonsUsdcBalance()
      fetchUserUsdcBalance()
      fetchNextAllowedDisburseTime()
    })
    setShowDisbursementInput(false)
    setDisbursementValue('0')
  }

  const knock = () => {
    walletClient.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'knock',
      args: [knockMemo]
    })
    setShowKnockInput(false)
    setKnockMemo('')
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
    setShowAddAdmin(false)
    setAdminAddress('0x')
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
    setShowAddParticipant(false)
    setParticipantAddress('0x')
  }

  const removeAdmin = (addressToRemove: string) => {
    if (window.confirm(`Are you sure you want to remove admin ${addressToRemove}?`)) {
      walletClient.writeContract({
        chain: walletClient.chain,
        account: address,
        abi: MOONS_ABI,
        address: selectedContract,
        functionName: 'removeAdmin',
        args: [addressToRemove]
      }).then(_ => fetchAdmins())
    }
  }
  
  const removeParticipant = (addressToRemove: string) => {
    if (window.confirm(`Are you sure you want to remove participant ${addressToRemove}?`)) {
      walletClient.writeContract({
        chain: walletClient.chain,
        account: address,
        abi: MOONS_ABI,
        address: selectedContract,
        functionName: 'removeParticipant',
        args: [addressToRemove]
      }).then(_ => fetchParticipants())
    }
  }  

  const handleEvent = (eventMessage: string) => {
    setEventFeed(prevFeed => [eventMessage, ...prevFeed])
  }

  useEffect(() => {
    const fetchData = () => {
      fetchName()
      fetchConstitution()
      fetchStartTime()
      fetchCycleTime()
      fetchUserUsdcBalance()
      fetchMoonsUsdcBalance()
      fetchAdmins()
      fetchParticipants()
      fetchMaximumAllowedDisbursement()
      fetchNextAllowedDisburseTime()
    }

    fetchData()
    
    const interval = setInterval(fetchData, 15000)

    const unwatchAdminAdded = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'AdminAdded',
      onLogs: logs => {
        fetchAdmins()
        logs.forEach(_ => handleEvent('AdminAdded'))
      }
    })

    const unwatchAdminRemoved = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'AdminRemoved',
      onLogs: logs => {
        fetchAdmins()
        logs.forEach(_ => handleEvent('AdminRemoved'))
      }
    })

    const unwatchParticipantAdded = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'ParticipantAdded',
      onLogs: logs => {
        fetchParticipants()
        logs.forEach(_ => handleEvent('ParticipantAdded'))
      }
    })

    const unwatchParticipantRemoved = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'ParticipantRemoved',
      onLogs: logs => {
        fetchParticipants()
        logs.forEach(_ => handleEvent('ParticipantRemoved'))
      }
    })

    const unwatchTransferToMoons = publicClient.watchContractEvent({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      eventName: 'Transfer',
      args: { to: selectedContract },
      onLogs: logs => {
        fetchMoonsUsdcBalance()
        logs.forEach(_ => handleEvent('FundsAdded'))
      }
    })

    const unwatchFundsDisbursed = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'FundsDisbursed',
      onLogs: logs => {
        fetchMoonsUsdcBalance()
        logs.forEach(_ => handleEvent('FundsDisbursed'))
      }
    })

    const unwatchKnock = publicClient.watchContractEvent({
      address: selectedContract,
      abi: MOONS_ABI,
      eventName: 'Knock',
      onLogs: logs => {
        logs.forEach(_ => handleEvent('Knock'))
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
      unwatchKnock()
    }
}, [])

  const isParticipant = participants[address] ? true : false
  const cycleTimeNumber = Number(cycleTime)
  const participantCount = BigInt(Object.keys(participants).length)

  const getCycleLocation = (address: Address): [bigint, number, bigint] => {
    const rank = participants[address]
    if (!rank) return [BigInt(0), 0, BigInt(0)]
    if (!cycleTime) return [BigInt(0), 0, BigInt(0)]
    if (!participantCount) return [BigInt(0), 0, BigInt(0)]
    const rankOffsetSeconds = ((rank - BigInt(1)) / participantCount) * cycleTime
    const phaseSeconds = ((nowSeconds - startTime) + (((rank - BigInt(1)) / participantCount) * cycleTime)) % cycleTime
    const phaseSecondsNumber = Number(phaseSeconds)
    const cycleRadians = cycleTimeNumber !== 0 ? (phaseSecondsNumber * 2 * Math.PI / cycleTimeNumber) : 0
    const cycleMaxTime =  currentCycleMid + rankOffsetSeconds
    return [rankOffsetSeconds, cycleRadians, cycleMaxTime]
  }

  const nowSeconds = BigInt(Date.now()) / BigInt(1000)
  const mayDisburse = nextAllowedDisburseTime ? nowSeconds > nextAllowedDisburseTime : false
  const currentCycleSecondsElapsed = cycleTime ? (nowSeconds - startTime) % cycleTime : BigInt(0)
  const currentCycleSecondsRemaining = cycleTime - currentCycleSecondsElapsed
  const currentCycleEnd = nowSeconds  + currentCycleSecondsRemaining
  const currentCycleEndIn = nowSeconds - currentCycleEnd
  const currentCycleMid = currentCycleEnd - (cycleTime / BigInt(2))
  const currentCycleStart = currentCycleEnd - cycleTime

  const yourCycleLocation = getCycleLocation(address)
  const yourMarkers = isParticipant ? [{ radians: yourCycleLocation[1], color: "#007BFF"}] : []
  const participantMarkers = Object.keys(participants).map(addr => {
    const cycleLocation = getCycleLocation(addr as Address)
    return { radians: cycleLocation[1], color: getColorFromAddress(addr as Address) }
  })
  const markers = [ ...yourMarkers,  ...participantMarkers]

  const yourCycleMaxTime = yourCycleLocation ? yourCycleLocation[2] : BigInt(0)
  const currentCycleMaxAgo = nowSeconds - yourCycleMaxTime
  const currentCycleMaxIn = yourCycleMaxTime - nowSeconds

  const phaseLabel = yourCycleMaxTime > nowSeconds ? 'Waxing' : 'Waning';
  const timeFromMaxSeconds = yourCycleMaxTime > nowSeconds ? Number(currentCycleMaxIn) : Number(currentCycleMaxAgo);
  const timeFromMaxHMS = new Date(timeFromMaxSeconds * 1000).toISOString().substring(11, 19);
  const timeAboutMaxString = yourCycleMaxTime > nowSeconds
    ? `${timeFromMaxHMS} until max`
    : `${timeFromMaxHMS} since max`;

  const timeFromMinSeconds = yourCycleMaxTime > nowSeconds ? Number(nowSeconds - currentCycleStart + yourCycleLocation[0]) : Number(currentCycleEnd + yourCycleLocation[0] - nowSeconds);
  const timeFromMinHMS = new Date(timeFromMinSeconds * 1000).toISOString().substring(11, 19);
  const timeAboutMinString = yourCycleMaxTime > nowSeconds
    ? `${timeFromMinHMS} since min`
    : `${timeFromMinHMS} until min`;

  const participantList = getSortedAddressesByRank(participants).map(addr => {
    return (
      <AddressBubble
        key={`participant-${addr}`}
        address={addr}
        textColor={getColorFromAddress(addr)}
        onLongPress={() => isAdmin && removeParticipant(addr)}
      />
    )
  })
  
  const adminList = getSortedAddressesByRank(admins).map(addr => {
    return (
      <AddressBubble
        key={`admin-${addr}`}
        address={addr}
        textColor='#F6F1D5'
        onLongPress={() => isAdmin && removeAdmin(addr)}
      />
    )
  })
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', width: '800px' }}>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', marginRight: '1em' }}>
          <QRCodeSVG value={getAddress(selectedContract)} fgColor='#F6F1D5' bgColor='#000000' />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start' }}>
          <h2 style={{ margin: '0' }}>{moonsName}</h2>
          <h1 style={{ fontFamily: 'monospace', fontSize: '6em', margin: '0', color: '#F6F1D5' }}>{`${formatUSDC(contractUsdcBalance)} USDC`}</h1>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: '1em'}}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {isParticipant && <h4 style={{ fontSize: '1.5em', fontFamily: 'monospace', margin: '0', marginTop: '0.5em' }}>{phaseLabel}</h4>}
          <h4 style={{ fontSize: '1.3em', fontFamily: 'monospace', margin: '0', marginTop: '0.5em' }}>T = {(cycleTimeNumber / (3600 * 24)).toFixed(2)} days</h4>
        </div>
        {isParticipant && <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '1.4em', fontFamily: 'monospace', margin: '0', marginTop: '0.5em' }}>{timeAboutMaxString}</h4>
          <h4 style={{ fontSize: '1.4em', fontFamily: 'monospace', margin: '0', marginTop: '0.5em' }}>{timeAboutMinString}</h4>
        </div>}
      </div>
      <SineWave height={200} width={800} markers={markers} />
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', marginBottom: '2em'}}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {!isParticipant && (
            <div style={{ marginBottom: '1em'}}>
              {showKnockInput ? (
                <div>
                  <input
                    type="text"
                    placeholder="Knock message"
                    value={knockMemo}
                    onChange={e => setKnockMemo(e.target.value)}
                  />
                  <button onClick={knock} disabled={!knockMemo}>Knock</button>
                  <button onClick={() => setShowKnockInput(false)}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowKnockInput(true)}>Knock</button>
              )}
            </div>
          )}
          {isParticipant && mayDisburse && (
            <div style={{ marginBottom: '1em'}}>
              {showDisbursementInput ? (
                <div>
                  <input
                    type="text"
                    placeholder="Disbursement Value"
                    value={disbursementValue}
                    onChange={handleDisbursementChange}
                  />
                  <button onClick={disburseFunds} disabled={!!disbursmentError || !disbursementValue}>Disburse</button>
                  <button onClick={() => setShowDisbursementInput(false)}>Cancel</button>
                  {disbursmentError && <div style={{ color: 'red' }}>{disbursmentError}</div>}
                </div>
              ) : (
                <button onClick={() => setShowDisbursementInput(true)}>Disburse Funds</button>
              )}
            </div>
          )}
          {!isParticipant && <h4 style={{ fontSize: '1em', margin: '0', marginBottom: '1em', alignSelf: 'center' }}>You are not currently a participant of this Moons protocol instance</h4>}
          {isParticipant && mayDisburse && <h4 style={{ fontSize: '2em', fontWeight: 'bold', fontFamily: 'monospace', margin: '0', marginBottom: '1em', alignSelf: 'center' }}>{formatUSDC(maximumAllowedDisbursement)} USDC</h4>}
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'row'}}>
        <div style={{display: 'flex', flexDirection: 'column', flexGrow: '3'}}>
          <h3 style={{ margin: '0' }}>
            Event feed
          </h3>
          {eventFeed.map((event, index) => (
            <div key={index}>
              {event}
            </div>
          ))}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', flexGrow: '1'}}>
          <h3 style={{ margin: '0' }}>
            Participants
            {isAdmin && !showAddParticipant && <button onClick={() => setShowAddParticipant(true)}>+</button>}
          </h3>
          {showAddParticipant && (
            <div>
              <input
                type="text"
                placeholder="Participant Address"
                value={participantAddress}
                onChange={(e) => setParticipantAddress(e.target.value)}
              />
              <button onClick={addParticipant}>Add</button>
              <button onClick={() => setShowAddParticipant(false)}>Cancel</button>
            </div>
          )}
          <div style={{ display: 'flex', marginBottom: '1em' }}>
            {participantList}
          </div>
          
          <h3 style={{ margin: '0' }}>
            Administrators
            {isAdmin && !showAddAdmin && <button onClick={() => setShowAddAdmin(true)}>+</button>}
          </h3>
          {showAddAdmin && (
            <div>
              <input
                type="text"
                placeholder="Admin Address"
                value={adminAddress}
                onChange={(e) => setAdminAddress(e.target.value)}
              />
              <button onClick={addAdmin}>Add</button>
              <button onClick={() => setShowAddAdmin(false)}>Cancel</button>
            </div>
          )}
          <div style={{ display: 'flex' }}>
            {adminList}
          </div>
        </div>  
      </div>
    </div>
  )
}

const App = () => {
  const { publicClient, address, walletClient } = useWalletClientContext()
  const [contracts, setContracts] = useState<Address[]>([])
  const [selectedContract, setSelectedContract] = useState<Address>('0x')
  const [error, setError] = useState('')

  useEffect(() => {})

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
    const contractName = window.prompt("Please enter the name of the new Moons contract.\nYou can change this later.");
    if (!contractName) {
      return;
    }
  
    let daysPerCycle;
    while (true) {
      const daysInput = window.prompt("Please enter the number of days per Moons cycle (between 2 and 90).\nWARNING: Cycle length is immutable and may not be changed later");
      daysPerCycle = daysInput ? parseInt(daysInput, 10) : 0;
      if (isNaN(daysPerCycle) || daysPerCycle < 2 || daysPerCycle > 90) {
        alert("Invalid input. Please enter a number between 2 and 90.");
      } else {
        break;
      }
    }
  
    const secondsPerCycle = daysPerCycle * 24 * 60 * 60; // Convert days to seconds
  
    if (window.confirm(`Are you sure you want to deploy a new Moons contract named ${contractName} with a cycle length of ${daysPerCycle} days?`)) {
      const args = [contractName, "", secondsPerCycle];
      const data = encodeDeployData({ abi: MOONS_ABI, bytecode: MOONS_BYTECODE, args });
      const gasLimit = await publicClient.estimateGas({
        account: address,
        data: data
      });
      console.log(`Gas estimate: ${gasLimit}`);
      const hash = await walletClient.deployContract({
        gas: gasLimit,
        abi: MOONS_ABI,
        bytecode: MOONS_BYTECODE,
        args,
        account: address,
        chain: base
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.contractAddress) {
        handleAddContract(receipt.contractAddress);
      }
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
