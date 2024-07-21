import React, { useState, useEffect, useRef, useMemo, ChangeEvent, MutableRefObject } from 'react'
import { useWalletClientContext } from './loader'
import { QRCodeSVG } from 'qrcode.react'
import { Address, isAddress, getContract, encodeDeployData, Log, Client, getAddress, decodeEventLog, parseAbiItem } from 'viem'
import { ERC20_ABI, USDC_ADDRESS } from './constants'
import { MOONS_ABI, MOONS_BYTECODE } from './moons'
import { base } from 'viem/chains'
import SineWave from './sine'
import { AddressBubble, getColorFromAddress } from './util'

function formatUSDC(amount: bigint): string {
  const usdcDecimals = 6n; // USDC has 6 decimal places
  const factor = 10n ** usdcDecimals;
  const integerPart = amount / factor;
  const fractionalPart = amount % factor;

  const fractionalString = fractionalPart.toString().padStart(Number(usdcDecimals), '0').slice(0, 2);
  return `${integerPart.toString()}.${fractionalString}`;
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

function timeAgo(currentBlock: bigint, eventBlock: bigint): string {
  const blockTimeInSeconds = BigInt(2);
  const secondsAgo = (currentBlock - eventBlock) * blockTimeInSeconds;

  if (secondsAgo < 60) {
      return `${secondsAgo} second${secondsAgo !== BigInt(1) ? 's' : ''} ago`;
  } else if (secondsAgo < 3600) {
      const minutesAgo = secondsAgo / BigInt(60);
      return `${minutesAgo} minute${minutesAgo !== BigInt(1) ? 's' : ''} ago`;
  } else {
      const hoursAgo = secondsAgo / BigInt(3600);
      return `${hoursAgo} hour${hoursAgo !== BigInt(1) ? 's' : ''} ago`;
  }
}

function usePrevious<T>(
  value: T,
  initial: T
): MutableRefObject<T>['current'] {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current ?? initial;
}

type MoonsUserEvent = {
  title: string,
  message: string
  actor: Address
  obj?: Address
  blockNumber: bigint
}

const Moons = ({ selectedContract } : { selectedContract: Address }) => {
  const { address, publicClient, walletClient } = useWalletClientContext()
  const [moonsName, setMoonsName] = useState('')
  const [moonsConstitution, setMoonsConstitution] = useState('')
  const [contractUsdcBalance, setContractUsdcBalance] = useState<bigint>(BigInt(0))
  const [admins, setAdmins] = useState<{[key: Address]: BigInt}>({})
  const [participants, setParticipants] = useState<{[key: Address]: bigint}>({})
  const [maximumAllowedDisbursement, setMaximumAllowedDisbursement] = useState<bigint>(BigInt(0))
  const [eventFeed, setEventFeed] = useState<MoonsUserEvent[]>([])
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
  const [blockNumber, setBlockNumber] = useState<bigint>(BigInt(0))
  const prevBlockNumber = usePrevious<bigint>(blockNumber, BigInt(0))

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
    walletClient?.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'disburseFunds',
      args: [USDC_ADDRESS, valueInMicroUSDC, '']
    }).then(_ => {
      fetchMoonsUsdcBalance()
      fetchNextAllowedDisburseTime()
    })
    setShowDisbursementInput(false)
    setDisbursementValue('0')
  }

  const knock = () => {
    walletClient?.writeContract({
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
    walletClient?.writeContract({
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
    walletClient?.writeContract({
      chain: walletClient.chain,
      account: address,
      abi: MOONS_ABI,
      address: selectedContract,
      functionName: 'addParticipant',
      args: [participantAddress, 'Welcome to our new participant.']
    }).then(_ => {
      fetchParticipants()
      fetchMaximumAllowedDisbursement()
    })
    setShowAddParticipant(false)
    setParticipantAddress('0x')
  }

  const removeAdmin = (addressToRemove: string) => {
    if (window.confirm(`Are you sure you want to remove admin ${addressToRemove}?`)) {
      walletClient?.writeContract({
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
      walletClient?.writeContract({
        chain: walletClient.chain,
        account: address,
        abi: MOONS_ABI,
        address: selectedContract,
        functionName: 'removeParticipant',
        args: [addressToRemove]
      }).then(_ => {
        fetchParticipants()
        fetchMaximumAllowedDisbursement()
      })
    }
  }  

  const addUserEvents = (userEvents: MoonsUserEvent[]) => {
    setEventFeed(prevFeed => [...userEvents.toReversed(), ...prevFeed])
  }

  const updateBlockNumber = () => {
    publicClient.getBlockNumber().then(setBlockNumber)
  }

  useEffect(() => {
    if (isAddress(selectedContract)) {
      window.location.hash = selectedContract;
    } else {
      window.location.hash = ''
    }
  }, [selectedContract]);

  useEffect(() => {
    updateBlockNumber()
    const interval = setInterval(updateBlockNumber, 5000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (blockNumber <= prevBlockNumber) {
      console.log(`Current block is not greater than previous, not fetching events.`)
      return
    }

    const MAX_BLOCKS = BigInt(1000)
    const fromBlock = blockNumber - prevBlockNumber + BigInt(1) > MAX_BLOCKS ? blockNumber - MAX_BLOCKS + BigInt(1) : prevBlockNumber + BigInt(1)
    const toBlock = blockNumber
    console.log(`${fromBlock} -- ${toBlock}`)

    const adminAddedAbi = parseAbiItem('event AdminAdded(address indexed admin, address indexed by, uint256 rank, string memo)')
    const adminRemovedAbi = parseAbiItem('event AdminRemoved(address indexed admin, address indexed by, uint256 rank, string memo)')
    const participantAddedAbi = parseAbiItem('event ParticipantAdded(address indexed participant, address indexed by, uint256 rank, string memo)')
    const participantRemovedAbi = parseAbiItem('event ParticipantRemoved(address indexed participant, address indexed by, uint256 rank, string memo)')
    const fundsDisbursedAbi = parseAbiItem('event FundsDisbursed(address indexed token, address indexed by, uint256 amount, string memo)')
    const constitutionChangedAbi = parseAbiItem('event ConstitutionChanged(address indexed by, string constitution)')
    const nameChangedAbi = parseAbiItem('event NameChanged(address indexed by, string name)')
    const knockAbi = parseAbiItem('event Knock(address indexed addr, string memo)')
    const transferAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

    const adminAddedEvents = publicClient.getLogs({
      address: selectedContract,
      event: adminAddedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      if (logs.length > 0) {
        fetchAdmins()
      }
      return logs.map(log => {
        return {
          title: 'Admin added',
          actor: log.args.by ?? '0x',
          obj: log.args.admin,
          message: log.args.memo ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const adminRemovedEvents = publicClient.getLogs({
      address: selectedContract,
      event: adminRemovedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      if (logs.length > 0) {
        fetchAdmins()
      }
      return logs.map(log => {
        return {
          title: 'Admin removed',
          actor: log.args.by ?? '0x',
          obj: log.args.admin,
          message: log.args.memo ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const participantAddedEvents = publicClient.getLogs({
      address: selectedContract,
      event: participantAddedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      if (logs.length > 0) {
        fetchParticipants()
      }
      return logs.map(log => {
        return {
          title: 'Participant added',
          actor: log.args.by ?? '0x',
          obj: log.args.participant,
          message: log.args.memo ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const participantRemovedEvents = publicClient.getLogs({
      address: selectedContract,
      event: participantRemovedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      if (logs.length > 0) {
        fetchParticipants()
      }
      return logs.map(log => {
        return {
          title: 'Participant removed',
          actor: log.args.by ?? '0x',
          obj: log.args.participant,
          message: log.args.memo ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const fundsDisbursedEvents = publicClient.getLogs({
      address: selectedContract,
      event: fundsDisbursedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      return logs.map(log => {
        if (logs.length > 0) {
          fetchMoonsUsdcBalance()
        }
        return {
          title: 'Funds disbursed',
          actor: log.args.by ?? '0x',
          obj: log.args.token,
          message: log.args.memo ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const constitutionChangedEvents = publicClient.getLogs({
      address: selectedContract,
      event: constitutionChangedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      if (logs.length > 0) {
        fetchConstitution()
      }
      return logs.map(log => {
        return {
          title: 'Constitution changed',
          actor: log.args.by ?? '0x',
          message: log.args.constitution ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const nameChangedEvents = publicClient.getLogs({
      address: selectedContract,
      event: nameChangedAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      if (logs.length > 0) {
        fetchName()
      }
      return logs.map(log => {
        return {
          title: 'Name changed',
          actor: log.args.by ?? '0x',
          message: log.args.name ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const knockEvents = publicClient.getLogs({
      address: selectedContract,
      event: knockAbi,
      fromBlock,
      toBlock
    }).then(logs => {
      return logs.map(log => {
        return {
          title: 'Message received',
          actor: log.args.addr ?? '0x',
          message: log.args.memo ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const fundsReceivedEvents = publicClient.getLogs({
      address: USDC_ADDRESS,
      event: transferAbi,
      fromBlock,
      toBlock,
      args: {
        to: selectedContract
      }
    }).then(logs => {
      if (logs.length > 0) {
        fetchMoonsUsdcBalance()
      }
      return logs.map(log => {
        return {
          title: 'Funds contributed',
          actor: log.args.from ?? '0x',
          message: `${formatUSDC(log.args.value ?? BigInt(0))} USDC` ?? '',
          blockNumber: log.blockNumber
        }
      })
    })

    const allEventPromises = [adminAddedEvents, adminRemovedEvents,
      participantAddedEvents, participantRemovedEvents,
      fundsDisbursedEvents, nameChangedEvents, constitutionChangedEvents,
      knockEvents, fundsReceivedEvents]
    Promise.all(allEventPromises).then((
      [ adminAddedEvents, adminRemovedEvents,
        participantAddedEvents, participantRemovedEvents,
        fundsDisbursedEvents, nameChangedEvents, constitutionChangedEvents,
        knockEvents, fundsReceivedEvents ]) => {
      const allEvents = [...adminAddedEvents, ...adminRemovedEvents,
        ...participantAddedEvents, ...participantRemovedEvents,
        ...fundsDisbursedEvents, ...nameChangedEvents, ...constitutionChangedEvents,
        ...knockEvents, ...fundsReceivedEvents];
      allEvents.sort((a, b) => Number(a.blockNumber - b.blockNumber));
      return allEvents
    }).then(addUserEvents)

  }, [blockNumber])

  useEffect(() => {
    fetchName()
    fetchConstitution()
    fetchStartTime()
    fetchCycleTime()
    fetchMoonsUsdcBalance()
    fetchAdmins()
    fetchParticipants()
    fetchMaximumAllowedDisbursement()
    fetchNextAllowedDisburseTime()
    return () => { }
}, [selectedContract, address])

  const isParticipant = participants[address] ? true : false
  const cycleTimeNumber = Number(cycleTime)
  const participantCountNumber = Object.keys(participants).length
  const participantCount = BigInt(participantCountNumber)

  const nowSeconds = BigInt(Date.now()) / BigInt(1000)
  const mayDisburse = nextAllowedDisburseTime ? nowSeconds > nextAllowedDisburseTime : false
  const currentCycleSecondsElapsed = cycleTime ? (nowSeconds - startTime) % cycleTime : BigInt(0)
  const currentCycleSecondsRemaining = cycleTime - currentCycleSecondsElapsed
  const currentCycleEnd = nowSeconds  + currentCycleSecondsRemaining
  const currentCycleMid = currentCycleEnd - (cycleTime / BigInt(2))
  const currentCycleStart = currentCycleEnd - cycleTime

  const getCycleLocation = (address: Address): [bigint, number, bigint] => {
    const rank = participants[address]
    if (!rank) return [BigInt(0), 0, BigInt(0)]
    if (!cycleTime) return [BigInt(0), 0, BigInt(0)]
    if (!participantCount) return [BigInt(0), 0, BigInt(0)]
    const rankOffsetSeconds = ((rank - BigInt(1)) * cycleTime) / participantCount
    const phaseSeconds = (nowSeconds - startTime + rankOffsetSeconds) % cycleTime
    const phaseSecondsNumber = Number(phaseSeconds)
    const cycleRadians = cycleTimeNumber !== 0 ? (phaseSecondsNumber * 2 * Math.PI / cycleTimeNumber) : 0
    const cycleMaxTime =  currentCycleMid + rankOffsetSeconds
    return [rankOffsetSeconds, cycleRadians, cycleMaxTime]
  }

  const yourCycleLocation = getCycleLocation(address)
  const yourCycleRadians = yourCycleLocation[1]
  const yourMarkers = isParticipant ? [{ radians: yourCycleRadians, color: "#007BFF", radius: 12}] : []
  const participantMarkers = Object.keys(participants).filter(addr => addr !== address).map(addr => {
    const cycleLocation = getCycleLocation(addr as Address)
    return { radians: cycleLocation[1], color: getColorFromAddress(addr as Address), radius: 6 }
  })
  const markers = [ ...yourMarkers,  ...participantMarkers]

  const allowanceMaxRatio = 1 / Math.sqrt(participantCountNumber)
  const yourCycleMultiplier = participantCountNumber ? (Math.sin(yourCycleRadians / 2) ** 2) * allowanceMaxRatio : 0

  const yourCycleMaxTime = yourCycleLocation ? yourCycleLocation[2] : BigInt(0)
  const currentCycleMaxAgo = nowSeconds - yourCycleMaxTime
  const currentCycleMaxIn = yourCycleMaxTime - nowSeconds

  const formatTime = (totalSeconds: bigint) => {
    const days = totalSeconds / BigInt(86400);
    const hours = totalSeconds % BigInt(86400) / BigInt(3600);
    const minutes = totalSeconds % BigInt(3600) / BigInt(60);
    const seconds = totalSeconds % BigInt(60);
  
    const pad = (n: bigint) => n.toString().padStart(2, '0');
  
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  };
  
  const phaseLabel = yourCycleMaxTime > nowSeconds ? 'Waxing' : 'Waning';
  const timeFromMaxSeconds = yourCycleMaxTime > nowSeconds ? currentCycleMaxIn : currentCycleMaxAgo;
  const timeAboutMaxString = yourCycleMaxTime > nowSeconds
    ? `${formatTime(timeFromMaxSeconds)} until max`
    : `${formatTime(timeFromMaxSeconds)} since max`;
  
  const timeFromMinSeconds = yourCycleMaxTime > nowSeconds ? nowSeconds - currentCycleStart + yourCycleLocation[0] : currentCycleEnd + yourCycleLocation[0] - nowSeconds;
  const timeAboutMinString = yourCycleMaxTime > nowSeconds
    ? `${formatTime(timeFromMinSeconds)} since min`
    : `${formatTime(timeFromMinSeconds)} until min`;  

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
        textColor={getColorFromAddress(addr)}
        onLongPress={() => isAdmin && removeAdmin(addr)}
      />
    )
  })

  const copyToClipboard = (addr: string) => {
    navigator.clipboard.writeText(`${addr}`);
    alert(`'${moonsName}' address copied to clipboard`);
  };
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', width: '100%', maxWidth: '480px' }}>
      {address === '0x' && <h4 style={{ fontWeight: 'lighter', color: '#e8eced', fontSize: '1rem', margin: '0', marginTop: '0.5rem', marginLeft: '1rem' }}>Connect a wallet to interact with this contract</h4>}
      {!isParticipant && address !== '0x' && <h4 style={{ fontWeight: 'lighter', color: '#e8eced', fontSize: '1rem', margin: '0', marginTop: '0.5rem', marginLeft: '1rem'}}>You are not currently a participant of this contract</h4>}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', marginRight: '1rem' }}>
          <QRCodeSVG value={getAddress(selectedContract)} onClick={() => copyToClipboard(selectedContract)} fgColor='#F6F1D5' bgColor='#000000' />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start' }}>
          <h2 style={{ fontFamily: 'monospace', fontSize: '1.6rem', margin: '0' }}>{moonsName}</h2>
          <h1 style={{ fontFamily: 'monospace', fontSize: '2rem', margin: '0', color: '#F6F1D5' }}>{`${formatUSDC(contractUsdcBalance)} USDC`}</h1>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', padding: '1rem'}}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {isParticipant && <h4 style={{ fontSize: '1.2rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{phaseLabel}</h4>}
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>T = {(cycleTimeNumber / (3600 * 24)).toFixed(2)} days</h4>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{`Max = ${(allowanceMaxRatio*100).toFixed(2)}%`}</h4>
        </div>
        {isParticipant && <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{timeAboutMaxString}</h4>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{timeAboutMinString}</h4>
        </div>}
      </div>
      <div style={{display: 'flex', flexDirection: 'row', width: '100%', justifyContent: 'center'}}>
        <SineWave width={480} height={148} markers={markers} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {isParticipant && mayDisburse && <h4 style={{ fontSize: '1rem', margin: '0', marginBottom: '0.25rem', alignSelf: 'center' }}>Current allowance</h4>}
          <div style={{ display: 'flex', flexDirection: 'row', alignContent: 'center'}}>
            {isParticipant && mayDisburse && <h4 style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace', margin: '0', marginBottom: '0.25rem', marginRight: '0.5rem', alignSelf: 'center' }}>{formatUSDC(maximumAllowedDisbursement)} USDC</h4>}
            {isParticipant && mayDisburse && <h4 style={{ fontSize: '1rem', fontFamily: 'monospace', margin: '0', marginBottom: '0.25rem', alignSelf: 'center' }}>{`(${(yourCycleMultiplier * 100).toFixed(2)}%)`}</h4>}
          </div>
          {isParticipant && mayDisburse && (
              <div style={{ marginBottom: '1rem', marginTop: '1rem'}}>
                {showDisbursementInput ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Disbursement Value"
                      value={disbursementValue}
                      onChange={handleDisbursementChange}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <button onClick={disburseFunds} style={{ marginRight: '0.5rem' }} disabled={!!disbursmentError || !disbursementValue}>Disburse</button>
                    <button onClick={() => setShowDisbursementInput(false)} style={{ marginRight: '0.5rem' }}>Cancel</button>
                    {disbursmentError && <div style={{ color: 'red' }}>{disbursmentError}</div>}
                  </div>
                ) : (
                  <button onClick={() => setShowDisbursementInput(true)}>Disburse Funds</button>
                )}
              </div>
            )}
        </div>
      </div>
        <div style={{display: 'flex', flexDirection: 'column', padding: '1rem'}}>
          <h3 style={{ margin: '0' }}>
            Recent activity
          </h3>
          {eventFeed.map((event, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem', marginTop: '1rem', borderRadius: '20px', background: '#333333', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
              <h4 style={{ margin: '0', alignContent: 'center' }}>{event.title}</h4>
                <p style={{ color: '#F6F1D5', margin: '0' }}>{timeAgo(blockNumber, event.blockNumber)}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
                <AddressBubble address={event.actor} textColor={getColorFromAddress(event.actor)} />
                <p style={{ color: '#F6F1D5', marginLeft: '0.5rem', alignContent: 'center' }}>{event.message}</p>
              </div>
            </div>
          ))}
          { eventFeed.length == 0 && <p style={{ color: '#e8eced' }}>No recent activity to show</p>}
          {address !== '0x' && <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', marginTop: '0.5rem'}}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                {showKnockInput ? (
                  <div>
                    <input
                      type="text"
                      placeholder="Message"
                      value={knockMemo}
                      onChange={e => setKnockMemo(e.target.value)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <button onClick={knock} disabled={!knockMemo} style={{ marginRight: '0.5rem' }}>Send</button>
                    <button onClick={() => setShowKnockInput(false)}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setShowKnockInput(true)}>Broadcast a message</button>
                )}
            </div>
          </div>}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', padding: '1rem'}}>
          <h3 style={{ margin: '0' }}>
            Participants
            {isAdmin && !showAddParticipant && <button onClick={() => setShowAddParticipant(true)} style={{ marginLeft: '0.5rem' }}>+</button>}
          </h3>
          {showAddParticipant && (
            <div>
              <input
                type="text"
                placeholder="Participant Address"
                value={participantAddress}
                onChange={(e) => setParticipantAddress(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
              <button onClick={addParticipant} style={{ marginRight: '0.5rem' }}>Add</button>
              <button onClick={() => setShowAddParticipant(false)} style={{ marginRight: '0.5rem' }}>Cancel</button>
            </div>
          )}
          <div style={{ display: 'flex', marginBottom: '1rem' }}>
            {participantList}
          </div>
          
          <h3 style={{ margin: '0' }}>
            Administrators
            {isAdmin && !showAddAdmin && <button onClick={() => setShowAddAdmin(true)} style={{ marginLeft: '0.5rem' }}>+</button>}
          </h3>
          {showAddAdmin && (
            <div>
              <input
                type="text"
                placeholder="Admin Address"
                value={adminAddress}
                onChange={(e) => setAdminAddress(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
              <button onClick={addAdmin} style={{ marginRight: '0.5rem' }}>Add</button>
              <button onClick={() => setShowAddAdmin(false)} style={{ marginRight: '0.5rem' }}>Cancel</button>
            </div>
          )}
          <div style={{ display: 'flex' }}>
            {adminList}
          </div>
        </div>
    </div>
  )
}

const App = () => {
  const { publicClient, address, walletClient } = useWalletClientContext()
  const [contracts, setContracts] = useState<Address[]>([])
  const [selectedContract, setSelectedContract] = useState<Address>('0x')

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

  useEffect(() => {
    const hash = window.location.hash;
    console.log(hash)
    if (hash.startsWith('#')) {
      const address = hash.substring(1);
      if (isAddress(address)) {
        handleAddContract(address)
        setSelectedContract(address)
      }
    }
  }, []);

  const handleSelectContract = (contract: Address) => {
    setSelectedContract(contract)
  }

  const handleImport = () => {
    const contractAddressUnparsed = window.prompt("Please enter the address of the Moons contract to import.");
    const hexStart = contractAddressUnparsed?.indexOf('0x') ?? -1
    const contractAddress = hexStart !== -1 ? contractAddressUnparsed?.substring(hexStart, hexStart + 42) ?? '' : ''
    console.log(contractAddress)
    if (!contractAddress) {
      return;
    } else if (!isAddress(contractAddress)){
      alert("Invalid input.");
      return;
    }
    handleAddContract(contractAddress as Address)
    setSelectedContract(contractAddress as Address)
  }

  const handleDeploy = async () => {
    const contractName = window.prompt("Please enter the name of the new Moons contract.\nYou can change this later.");
    if (!contractName) {
      return;
    }

    let daysPerCycle;
    while (true) {
      const daysInput = window.prompt("Please enter the number of days per Moons cycle (between 1 and 90).\nWARNING: Cycle length is immutable and may not be changed later");
      daysPerCycle = daysInput ? parseInt(daysInput, 10) : 0;
      if (isNaN(daysPerCycle) || daysPerCycle < 1 || daysPerCycle > 90) {
        alert("Invalid input. Please enter a number between 1 and 90.");
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
      const hash = await walletClient?.deployContract({
        gas: gasLimit,
        abi: MOONS_ABI,
        bytecode: MOONS_BYTECODE,
        args,
        account: address,
        chain: base
      });
      const receipt = hash && await publicClient.waitForTransactionReceipt({ hash });
      if (receipt && receipt.contractAddress) {
        handleAddContract(receipt.contractAddress);
      }
    }
  }

  const handleAddContract = (addContract: Address) => {
    if (!contracts.includes(addContract)) {
      setContracts([...contracts, addContract])
    }
  }

  const handleRemoveContract = (contractToRemove: Address) => {
    setContracts(contracts.filter(contract => contract !== contractToRemove))
  }

  const mainContent = selectedContract !== '0x' ? <Moons selectedContract={selectedContract} /> : null

  return (
  <div style={{ display: 'flex', flexDirection: 'row' }}>
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {address !== '0x' && <ContractList
          contracts={contracts}
          onSelectContract={handleSelectContract}
          onImport={handleImport}
          onDeploy={handleDeploy}
          onRemove={handleRemoveContract}
        />}
      {mainContent}
    </div>
  </div>)
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
    <div style={{ width: '100%', overflowX: 'auto', display: 'flex', borderBottom: '1px solid #ddd', cursor: 'grab' }}>
      {contracts.map((contract, i) => (
        <div
          key={contract}
          style={{ marginLeft: i == 0 ? '1rem' : '0.5rem', marginRight: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: '180px' }}
          onMouseDown={() => startLongPress(contract)}
          onMouseUp={endLongPress}
          onMouseLeave={endLongPress}
          onTouchStart={() => startLongPress(contract)}
          onTouchEnd={endLongPress}
        >
          <h4 style={{ fontFamily: 'monospace', margin: '0', fontSize: '0.8rem' }} onClick={() => onSelectContract(contract)}>{contractNames[contract] ? contractNames[contract] : abrev(contract)}</h4>
        </div>
      ))}
      <div style={{ margin: '0.5rem', padding: '0.5rem', cursor: 'pointer' }} onClick={onDeploy}>
        <h4 style={{ fontFamily: 'monospace', margin: '0', fontSize: '0.8rem' }}>🚀  Deploy  🌑</h4>
      </div>
    </div>
  )
}


export default App
