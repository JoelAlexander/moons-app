import React, { useState, useEffect, useRef, useMemo, ChangeEvent, MutableRefObject } from 'react'
import { useWalletClientContext } from './loader'
import { QRCodeSVG } from 'qrcode.react'
import { Address, isAddress, getContract, encodeDeployData, Log, Client, getAddress, decodeEventLog, parseAbiItem, parseEventLogs } from 'viem'
import { ERC20_ABI, USDC_ADDRESS } from './constants'
import { MOONS_ABI, MOONS_BYTECODE } from './moons'
import { base } from 'viem/chains'
import { Abi } from 'viem'
import SineWave from './sine'
import { AddressBubble, AboutMoons, getColorFromAddress } from './util'

function formatUSDC(amount: bigint): string {
  const usdcDecimals = 6n; // USDC has 6 decimal places
  const fprimary = 10n ** usdcDecimals;
  const integerPart = amount / fprimary;
  const fractionalPart = amount % fprimary;

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

function timeInPast(currentBlock: bigint, eventBlock: bigint): string {
  const blockTimeInSeconds = BigInt(2);
  const secondsAgo = (currentBlock - eventBlock) * blockTimeInSeconds;

  if (secondsAgo < 60) {
      return `${secondsAgo} second${secondsAgo !== BigInt(1) ? 's' : ''}`;
  } else if (secondsAgo < 3600) {
      const minutesAgo = secondsAgo / BigInt(60);
      return `${minutesAgo} minute${minutesAgo !== BigInt(1) ? 's' : ''}`;
  } else {
      const hoursAgo = secondsAgo / BigInt(3600);
      return `${hoursAgo} hour${hoursAgo !== BigInt(1) ? 's' : ''}`;
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
  eventName: string,
  title: string,
  message: string
  primary?: Address
  secondary?: Address
  blockNumber: bigint
}

const MAX_BLOCKS = BigInt(1000)

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newName, setNewName] = useState(moonsName);
  const [newConstitution, setNewConstitution] = useState(moonsConstitution);
  const [eventsLoaderState, setEventsLoaderState] = useState<[bigint, bigint]>([BigInt(0), BigInt(0)])

  const usdcContract = getContract({ abi: ERC20_ABI, client: { public: publicClient }, address: USDC_ADDRESS })
  const moonsContract = getContract({ abi: MOONS_ABI, client: { public: publicClient }, address: selectedContract })

  const adminAddedAbi = parseAbiItem('event AdminAdded(address indexed admin, address indexed by, uint256 rank, string memo)')
  const adminRemovedAbi = parseAbiItem('event AdminRemoved(address indexed admin, address indexed by, uint256 rank, string memo)')
  const participantAddedAbi = parseAbiItem('event ParticipantAdded(address indexed participant, address indexed by, uint256 rank, string memo)')
  const participantRemovedAbi = parseAbiItem('event ParticipantRemoved(address indexed participant, address indexed by, uint256 rank, string memo)')
  const fundsDisbursedAbi = parseAbiItem('event FundsDisbursed(address indexed token, address indexed by, uint256 amount, string memo)')
  const constitutionChangedAbi = parseAbiItem('event ConstitutionChanged(address indexed by, string constitution)')
  const nameChangedAbi = parseAbiItem('event NameChanged(address indexed by, string name)')
  const knockAbi = parseAbiItem('event Knock(address indexed addr, string memo)')
  const transferAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

  const fetchName = () => {
    moonsContract.read.name().then(name => {
      setMoonsName(name as string)
    })
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
        args: [addressToRemove, ""] // TODO: Plumb a memo
      })
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
        args: [addressToRemove, ""] // TODO: Plumb a memo
      })
    }
  }

  const setName = (name: string) => {
    if (window.confirm(`Are you sure you want to set the name '${name}'?`)) {
      walletClient?.writeContract({
        chain: walletClient.chain,
        account: address,
        abi: MOONS_ABI,
        address: selectedContract,
        functionName: 'setName',
        args: [name]
      })
    }
  }

  const setConstitution = (constitution: string) => {
    if (window.confirm(`Are you sure you want to set the description '${constitution}'?`)) {
      walletClient?.writeContract({
        chain: walletClient.chain,
        account: address,
        abi: MOONS_ABI,
        address: selectedContract,
        functionName: 'setConstitution',
        args: [constitution]
      })
    }
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
  
  const loadEvents = (fromBlock: bigint, toBlock: bigint): Promise<[
    adminAddedEvents: MoonsUserEvent[],
    adminRemovedEvents: MoonsUserEvent[],
    participantAddedEvents: MoonsUserEvent[],
    participantRemovedEvents: MoonsUserEvent[],
    fundsDisbursedEvents: MoonsUserEvent[],
    nameChangedEvents: MoonsUserEvent[],
    constitutionChangedEvents: MoonsUserEvent[],
    knockEvents: MoonsUserEvent[],
    fundsReceivedEvents: MoonsUserEvent[]
  ]> => {
    const fundsReceivedEvents = publicClient.getLogs({
      address: USDC_ADDRESS,
      event: transferAbi,
      fromBlock,
      toBlock,
      args: {
        to: selectedContract
      }
    }).then(logs => {
      return logs.map(log => {
        return {
          eventName: log.eventName,
          title: 'Funds contributed',
          primary: log.args.from ?? '0x',
          message: `${formatUSDC(log.args.value ?? BigInt(0))} USDC` ?? '',
          blockNumber: log.blockNumber
        } as MoonsUserEvent
      })
    })

    const moonsEvents = publicClient.getLogs({
      address: selectedContract,
      fromBlock,
      toBlock
    }).then(events => {
      const parsedEvents = parseEventLogs({
        abi: [ adminAddedAbi, adminRemovedAbi, participantAddedAbi, participantRemovedAbi, nameChangedAbi, constitutionChangedAbi, fundsDisbursedAbi, knockAbi ],
        logs: events,
        eventName: [ "AdminAdded", "AdminRemoved", "ParticipantAdded", "ParticipantRemoved", "NameChanged", "ConstitutionChanged", "FundsDisbursed", "Knock"]
      })
      return parsedEvents.map(parsedEvent => {
        const event = decodeEventLog({
          abi: [ adminAddedAbi, adminRemovedAbi, participantAddedAbi, participantRemovedAbi, nameChangedAbi, constitutionChangedAbi, fundsDisbursedAbi, knockAbi ],
          data: parsedEvent.data,
          topics: [parsedEvent.topics[0], ...parsedEvent.topics.slice(1)]
        })
        switch (event.eventName) {
          case 'AdminAdded':
            return {
              eventName: event.eventName,
              title: 'Administrator Added',
              primary: event.args.admin,
              secondary: event.args.by,
              message: event.args.memo,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'AdminRemoved':
            return {
              eventName: event.eventName,
              title: 'Administrator Removed',
              primary: event.args.admin,
              secondary: event.args.by,
              message: event.args.memo,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'ParticipantAdded':
            return {
              eventName: event.eventName,
              title: 'Participant Added',
              primary: event.args.participant,
              secondary: event.args.by,
              message: event.args.memo,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'ParticipantRemoved':
            return {
              eventName: event.eventName,
              title: 'Participant Removed',
              primary: event.args.participant,
              secondary: event.args.by,
              message: event.args.memo,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'NameChanged':
            return {
              eventName: event.eventName,
              title: 'Name Changed',
              primary: event.args.by,
              message: event.args.name,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'ConstitutionChanged':
            return {
              eventName: event.eventName,
              title: 'Constitution Changed',
              secondary: event.args.by,
              message: event.args.constitution,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'FundsDisbursed':
            return {
              eventName: event.eventName,
              title: 'Funds Disbursed',
              primary: event.args.by,
              secondary: event.args.token,
              message: event.args.memo,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
          case 'Knock':
            return {
              eventName: event.eventName,
              title: 'Message Received',
              primary: event.args.addr,
              message: event.args.memo,
              blockNumber: parsedEvent.blockNumber
            } as MoonsUserEvent
        }
      })
    })

    const adminAddedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'AdminAdded')
    })

    const adminRemovedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'AdminRemoved')
    })

    const participantAddedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'ParticipantAdded')
    })

    const participantRemovedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'ParticipantRemoved')
    })

    const fundsDisbursedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'FundsDisbursed')
    })

    const nameChangedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'NameChanged')
    })

    const constitutionChangedEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'ConstitutionChanged')
    })

    const knockEvents = moonsEvents.then(events => {
      return events.filter(event => event.eventName === 'Knock')
    })

    const allEventPromises = [
      adminAddedEvents,
      adminRemovedEvents,
      participantAddedEvents,
      participantRemovedEvents,
      fundsDisbursedEvents,
      nameChangedEvents,
      constitutionChangedEvents,
      knockEvents,
      fundsReceivedEvents
    ]
    return Promise.all(allEventPromises).then((
      [
        adminAddedEvents,
        adminRemovedEvents,
        participantAddedEvents,
        participantRemovedEvents,
        fundsDisbursedEvents,
        nameChangedEvents,
        constitutionChangedEvents,
        knockEvents,
        fundsReceivedEvents
      ]: MoonsUserEvent[][]) => {
      return [
        adminAddedEvents,
        adminRemovedEvents,
        participantAddedEvents,
        participantRemovedEvents,
        fundsDisbursedEvents,
        nameChangedEvents,
        constitutionChangedEvents,
        knockEvents,
        fundsReceivedEvents
      ]
    })
  }

  useEffect(() => {

    if (!blockNumber || !prevBlockNumber || blockNumber <= prevBlockNumber) {
      console.log('Waiting for block number range...')
      return
    }

    if (blockNumber - prevBlockNumber + BigInt(1) > MAX_BLOCKS) {
      console.warn('Block number difference greater than max blocks, some events may be missed')
    }

    if (!eventsLoaderState[0]) {
      setEventsLoaderState([blockNumber, blockNumber])
    }

    const fromBlock = blockNumber - prevBlockNumber + BigInt(1) > MAX_BLOCKS ?
      blockNumber - MAX_BLOCKS + BigInt(1) :
      prevBlockNumber + BigInt(1)
    loadEvents(fromBlock, blockNumber).then(([
      adminAddedEvents,
      adminRemovedEvents,
      participantAddedEvents,
      participantRemovedEvents,
      fundsDisbursedEvents,
      nameChangedEvents,
      constitutionChangedEvents,
      knockEvents,
      fundsReceivedEvents
    ]: MoonsUserEvent[][]) => {

      if (adminAddedEvents.length > 0 || adminRemovedEvents.length > 0) {
        fetchAdmins()
      }

      if (participantAddedEvents.length > 0 || participantRemovedEvents.length > 0) {
        fetchParticipants()
        fetchMaximumAllowedDisbursement()
        fetchNextAllowedDisburseTime()
      }

      if (fundsDisbursedEvents.length > 0) {
        fetchMaximumAllowedDisbursement()
        fetchNextAllowedDisburseTime()
      }

      if (constitutionChangedEvents.length > 0) {
        fetchConstitution()
      }

      if (nameChangedEvents.length > 0) {
        fetchName()
      }

      if (fundsReceivedEvents.length > 0) {
        fetchMoonsUsdcBalance()
        fetchMaximumAllowedDisbursement()
      }

      const allEventsSorted = [
        ...adminAddedEvents,
        ...adminRemovedEvents,
         ...participantAddedEvents,
         ...participantRemovedEvents,
         ...fundsDisbursedEvents,
         ...nameChangedEvents,
         ...constitutionChangedEvents,
         ...knockEvents,
         ...fundsReceivedEvents
      ]
         .sort((a, b) => Number(a.blockNumber - b.blockNumber))
         .toReversed();

      setEventFeed(prev => [...allEventsSorted, ...prev])
    })
  }, [blockNumber])

  const MAX_CONCURRENT_REQUESTS = 2;

  const processInBatches = async (tasks: (() => Promise<MoonsUserEvent[][]>)[], batchSize: number): Promise<MoonsUserEvent[][]> => {
    const results: MoonsUserEvent[][] = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(task => task()));
      const resultsConcat = batchResults.reduce((acc, current) => acc.concat(current), []);
      results.push(...resultsConcat);
    }
    return results;
  };
  
  useEffect(() => {
    const requestedEventsBlockNumber = eventsLoaderState[0];
    const loadedEventsBlockNumber = eventsLoaderState[1];
    if (loadedEventsBlockNumber <= requestedEventsBlockNumber) {
      console.log('Loaded all requested events');
      return;
    }
  
    const blocksToLoad = loadedEventsBlockNumber - requestedEventsBlockNumber;
    const extraChunks = blocksToLoad % MAX_BLOCKS === BigInt(0) ? BigInt(0) : BigInt(1)
    const chunks = Number((blocksToLoad / MAX_BLOCKS) + extraChunks);
    const loadTasks = [];

    for (let i = 0; i < chunks; i++) {
      const fromBlock = loadedEventsBlockNumber - (BigInt(i + 1) * MAX_BLOCKS);
      const toBlock = loadedEventsBlockNumber - (BigInt(i) * MAX_BLOCKS) - BigInt(1);
      loadTasks.push(() => {
        const fromBlockToUse = fromBlock < requestedEventsBlockNumber ? requestedEventsBlockNumber : fromBlock
        return loadEvents(fromBlockToUse, toBlock)
      });
    }
  
    processInBatches(loadTasks, MAX_CONCURRENT_REQUESTS).then((results) => {
      const allEvents = results.flat();
      const historicalEventsSorted = allEvents
        .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber))
        .reverse();
  
      setEventFeed(prev => [...prev, ...historicalEventsSorted]);
      setEventsLoaderState((prevEventsLoaderState) => [prevEventsLoaderState[0], requestedEventsBlockNumber]);
    });
  
  }, [eventsLoaderState]);  
   

  useEffect(() => {
    setBlockNumber(BigInt(0))
    setEventFeed([])
    setEventsLoaderState([BigInt(0), BigInt(0)])
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
  const timeTillNextDisburse = nextAllowedDisburseTime - nowSeconds
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

  const getPhaseEmoji = (cycleRadians: number) => {
    const cyclePercentage = (cycleRadians / (2 * Math.PI)) * 100;
  
    if (cyclePercentage < 2.5 || cyclePercentage >= 97.5) return "🌑";
    if (cyclePercentage < 12.5) return "🌒";
    if (cyclePercentage < 27.5) return "🌓";
    if (cyclePercentage < 47.5) return "🌔";
    if (cyclePercentage < 49.5) return "🌕";
    if (cyclePercentage < 50.5) return "🌝";
    if (cyclePercentage < 52.5) return "🌕";
    if (cyclePercentage < 72.5) return "🌖";
    if (cyclePercentage < 87.5) return "🌗";
    if (cyclePercentage < 97.5) return "🌘";
  
    return "🌑"; // Fallback to a new moon emoji
  };
  
  const getPhaseLabel = (cycleRadians: number, currentTime: bigint, maxTime: bigint) => {
    const emoji = getPhaseEmoji(cycleRadians);
    const phaseLabel =
      cycleRadians < Math.PI * 0.05 || cycleRadians > Math.PI * 1.95
        ? "New"
        : cycleRadians > Math.PI * 0.95 && cycleRadians < Math.PI * 1.05
        ? "Full"
        : maxTime > currentTime
        ? "Waxing"
        : "Waning";
  
    return `${emoji} ${phaseLabel}`;
  };
  
  const phaseLabel = getPhaseLabel(
    yourCycleRadians,
    nowSeconds,
    yourCycleMaxTime
  );
  const timeFromMaxSeconds = yourCycleMaxTime > nowSeconds ? currentCycleMaxIn : currentCycleMaxAgo;
  const timeAboutMaxString = yourCycleMaxTime > nowSeconds
    ? `${formatTime(timeFromMaxSeconds)} until max`
    : `${formatTime(timeFromMaxSeconds)} since max`;
  
  const timeFromMinSeconds = yourCycleMaxTime > nowSeconds ? nowSeconds - currentCycleStart + yourCycleLocation[0] : currentCycleEnd + yourCycleLocation[0] - nowSeconds;

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
  
  const handleNameSubmit = () => {
    if (newName && newName !== moonsName) {
      setIsEditingName(false);
      setName(newName);
    }
  };

  const handleDescriptionSubmit = () => {
    if (newConstitution && newConstitution !== moonsConstitution) {
      setIsEditingDescription(false);
      setConstitution(newConstitution);
    }
  };

  const loadedEventsBlock = eventsLoaderState[1]
  const recentActivityString = loadedEventsBlock ? `Showing past ${timeInPast(blockNumber, loadedEventsBlock)} of activity` : ''
  const eventsLoading = eventsLoaderState[0] !== BigInt(0) && eventsLoaderState[0] !== eventsLoaderState[1]
  const canLoadEvents = eventsLoaderState[1] != BigInt(0)

  const handleLoadMoreEvents = () => {
    if (canLoadEvents) {
      setEventsLoaderState([eventsLoaderState[0] - BigInt((3600 * 24) / 2 / 2 / 2), eventsLoaderState[1]])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', width: '100%', maxWidth: '42rem', alignSelf: 'center' }}>
      {address === '0x' && <h4 style={{ fontWeight: 'lighter', color: '#e8eced', fontSize: '1rem', margin: '0', marginTop: '0.5rem', marginLeft: '1rem' }}>Connect a wallet to interact with this contract</h4>}
      {!isParticipant && address !== '0x' && <h4 style={{ fontWeight: 'lighter', color: '#e8eced', fontSize: '1rem', margin: '0', marginTop: '0.5rem', marginLeft: '1rem'}}>You are not currently a participant of this contract</h4>}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', marginRight: '1rem' }}>
          <QRCodeSVG value={getAddress(selectedContract)} onClick={() => copyToClipboard(selectedContract)} fgColor='#F6F1D5' bgColor='#000000' />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {isEditingName ? (
            <div style={{ display: 'flex', flexDirection: 'column'}}>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div style={{ display: 'flex', flexDirection: 'row'}}>
                <button onClick={handleNameSubmit} disabled={!newName || newName === moonsName}>Submit</button>
                <button onClick={() => setIsEditingName(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <h2 style={{ fontFamily: 'monospace', fontSize: '1.6rem', margin: '0' }}>
              {isAdmin && <button onClick={() => setIsEditingName(true)} style={{ marginRight: '0.5rem', fontSize: '0.6rem' }}>✏️</button>}
              {moonsName}
            </h2>
          )}
          {isEditingDescription ? (
            <div style={{ display: 'flex', flexDirection: 'column'}}>
              <input type="text" value={newConstitution} onChange={(e) => setNewConstitution(e.target.value)} />
              <div style={{ display: 'flex', flexDirection: 'row'}}>
                <button onClick={handleDescriptionSubmit} disabled={!newConstitution || newConstitution === moonsConstitution}>Submit</button>
                <button onClick={() => setIsEditingDescription(false)}>Cancel</button>
                </div>
            </div>
          ) : (
            <h3 style={{ fontFamily: 'monospace', fontSize: '0.8rem', margin: '0' }}>
              {isAdmin && <button onClick={() => setIsEditingDescription(true)} style={{ marginRight: '0.5rem', fontSize: '0.6rem' }}>✏️</button>}
              {moonsConstitution}
            </h3>
          )}
          <h1 style={{ fontFamily: 'monospace', fontSize: '2rem', margin: '0', color: '#F6F1D5' }}>{`${formatUSDC(contractUsdcBalance)} USDC`}</h1>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', padding: '1rem'}}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {isParticipant && <h4 style={{ fontSize: '1.3rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{phaseLabel}</h4>}
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{timeAboutMaxString}</h4>
        </div>
        {isParticipant && <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>T = {(cycleTimeNumber / (3600 * 24)).toFixed(2)} days</h4>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{`Max = ${(allowanceMaxRatio*100).toFixed(2)}%`}</h4>
        </div>}
      </div>
      <div style={{display: 'flex', flexDirection: 'row', width: '100%', justifyContent: 'center'}}>
        <SineWave height={148} markers={markers} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        {isParticipant && mayDisburse && <h4 style={{ fontSize: '1rem', margin: '0', marginBottom: '0.25rem', alignSelf: 'center' }}>Current allowance</h4>}
        {isParticipant && !mayDisburse && <h4 style={{ fontSize: '1rem', margin: '0', marginBottom: '0.25rem', alignSelf: 'center' }}>You may claim funds again in</h4>}
        <div style={{ display: 'flex', flexDirection: 'row', alignContent: 'center'}}>
            {isParticipant && mayDisburse && <h4 style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace', margin: '0', marginBottom: '0.25rem', marginRight: '0.5rem', alignSelf: 'center' }}>{formatUSDC(maximumAllowedDisbursement)} USDC</h4>}
            {isParticipant && mayDisburse && <h4 style={{ fontSize: '1rem', fontFamily: 'monospace', margin: '0', marginBottom: '0.25rem', alignSelf: 'center' }}>{`(${(yourCycleMultiplier * 100).toFixed(2)}%)`}</h4>}
            {isParticipant && !mayDisburse && <h4 style={{ fontSize: '1.4rem', margin: '0', fontWeight: 'bold', fontFamily: 'monospace', alignSelf: 'center' }}>{formatTime(timeTillNextDisburse)}</h4>}

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
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            <h3 style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'lighter', letterSpacing: '0.0618rem' }}>
              Recent Activity
            </h3>
          </div>

          {eventFeed.map((event, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem', marginTop: '1rem', borderRadius: '20px', background: '#333333', paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                <p style={{ color: '#FAFAFA', margin: '0', alignContent: 'center', fontFamily: 'Arial, sans-serif', fontSize: '1rem', fontWeight: 'bold' }}>{event.title}</p>
                <p style={{ fontFamily: 'monospace', color: '#FAFAFA', margin: '0', fontSize: '0.8rem' }}>{timeInPast(blockNumber, event.blockNumber)} ago</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
                {event.primary && <AddressBubble address={event.primary} textColor={getColorFromAddress(event.primary)} />}
              </div>
              {event.secondary && <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
                <p style={{ color: '#FAFAFA', marginRight: '0.5rem', alignContent: 'center', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>By</p>
                <AddressBubble address={event.secondary} textColor={getColorFromAddress(event.secondary)} />
              </div>}
              {event.message && <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
                <p style={{ color: '#FAFAFA', marginRight: '0.5rem', alignContent: 'center', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' }}>Message</p>
                <p style={{ color: '#F6F1D5', marginLeft: '0.5rem', alignContent: 'center', fontFamily: 'Arial, sans-serif' }}>{event.message}</p>
              </div>}
            </div>
          ))}
          { eventFeed.length == 0 && <p style={{ color: '#e8eced' }}>No activity to show</p>}
          { address !== '0x' && eventsLoading && <p style={{ color: '#e8eced' }}>Loading activity...</p>}
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
          { address !== '0x' &&
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <p style={{ color: '#e8eced', textAlign: 'center' }}>{recentActivityString}</p>
              {!eventsLoading && canLoadEvents && <button style={{ alignSelf: 'center' }} onClick={handleLoadMoreEvents}>Load more ↻</button>}
            </div>
          }
        </div>
        <div style={{display: 'flex', flexDirection: 'column', padding: '1rem'}}>
          <h3 style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'lighter', letterSpacing: '0.0618rem' }}>
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
          
          <h3 style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'lighter', letterSpacing: '0.0618rem' }}>
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
    setContracts(Array.from(new Set(storedContracts)))
  }, [])

  useEffect(() => {
    localStorage.setItem('contracts', JSON.stringify(contracts))
    if (!contracts.includes(selectedContract)) {
      setSelectedContract('0x')
    }
  }, [contracts])

  useEffect(() => {
    const hash = window.location.hash;
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
      setContracts(contracts => Array.from(new Set([...contracts, addContract])))
    }
  }

  const handleRemoveContract = (contractToRemove: Address) => {
    setContracts(contracts.filter(contract => contract !== contractToRemove))
  }

  const mainContent = selectedContract !== '0x' ? <Moons selectedContract={selectedContract} /> : <AboutMoons />

  return (
  <div style={{ display: 'flex', flexDirection: 'row' }}>
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {(address !== '0x' || contracts.length > 0) && <ContractList
          contracts={contracts}
          loggedIn={address !== '0x'}
          onSelectContract={handleSelectContract}
          onImport={handleImport}
          onDeploy={handleDeploy}
          onRemove={handleRemoveContract}
          onAbout={() => setSelectedContract('0x')}
        />}
      {mainContent}
    </div>
  </div>)
}

const ContractList = ({ contracts, loggedIn, onSelectContract, onDeploy, onRemove, onAbout }: { contracts: Address[], loggedIn: boolean, onSelectContract: (address: Address) => void, onImport: () => void, onDeploy: () => void, onRemove: (address: Address) => void, onAbout: () => void }) => {
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


export default App
