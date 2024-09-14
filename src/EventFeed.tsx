import React, { useState, useEffect, useRef } from 'react'
import { useWalletClientContext } from './loader'
import { Address, decodeEventLog, parseAbiItem, parseEventLogs } from 'viem'
import { MOONS_ABI } from './moons'
import { getColorFromAddress } from './util'
import { MutableRefObject } from 'react'
import { USDC_ADDRESS } from './constants'
import { formatUSDC } from './util'
import { Address as IdentityAddress, Avatar, Badge, Identity, Name } from '@coinbase/onchainkit/identity'

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

type MoonsUserEvent = {
  eventName: string,
  title: string,
  message: string
  primary?: Address
  secondary?: Address
  blockNumber: bigint
}

export type EventCallbacks = {
  onAdminChange?: () => void;
  onParticipantChange?: () => void;
  onFundsChange?: () => void;
  onConstitutionChange?: () => void;
  onNameChange?: () => void;
}

const MAX_BLOCKS = BigInt(1000)

export const EventFeed = ({ 
  selectedContract,
  callbacks
}: { 
  selectedContract: Address,
  callbacks: EventCallbacks
}) => {
  const { address, publicClient, walletClient } = useWalletClientContext()
  const [blockNumber, setBlockNumber] = useState<bigint>(BigInt(0))
  const prevBlockNumber = usePrevious<bigint>(blockNumber, BigInt(0))

  const [showKnockInput, setShowKnockInput] = useState(false)
  const [knockMemo, setKnockMemo] = useState('')

  const [eventFeed, setEventFeed] = useState<MoonsUserEvent[]>([])
  const [eventsLoaderState, setEventsLoaderState] = useState<[bigint, bigint]>([BigInt(0), BigInt(0)])

  const adminAddedAbi = parseAbiItem('event AdminAdded(address indexed admin, address indexed by, uint256 rank, string memo)')
  const adminRemovedAbi = parseAbiItem('event AdminRemoved(address indexed admin, address indexed by, uint256 rank, string memo)')
  const participantAddedAbi = parseAbiItem('event ParticipantAdded(address indexed participant, address indexed by, uint256 rank, string memo)')
  const participantRemovedAbi = parseAbiItem('event ParticipantRemoved(address indexed participant, address indexed by, uint256 rank, string memo)')
  const fundsDisbursedAbi = parseAbiItem('event FundsDisbursed(address indexed token, address indexed by, uint256 amount, string memo)')
  const constitutionChangedAbi = parseAbiItem('event ConstitutionChanged(address indexed by, string constitution)')
  const nameChangedAbi = parseAbiItem('event NameChanged(address indexed by, string name)')
  const knockAbi = parseAbiItem('event Knock(address indexed addr, string memo)')
  const transferAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

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

  const updateBlockNumber = () => {
    publicClient.getBlockNumber().then(setBlockNumber)
  }

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

  useEffect(() => {
    updateBlockNumber()
    const interval = setInterval(updateBlockNumber, 5000)
    return () => {
      clearInterval(interval)
    }
  }, [])

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
        callbacks.onAdminChange?.();
      }
  
      if (participantAddedEvents.length > 0 || participantRemovedEvents.length > 0) {
        callbacks.onParticipantChange?.();
        callbacks.onFundsChange?.();
      }
  
      if (fundsDisbursedEvents.length > 0 || fundsReceivedEvents.length > 0) {
        callbacks.onFundsChange?.();
      }
  
      if (constitutionChangedEvents.length > 0) {
        callbacks.onConstitutionChange?.();
      }
  
      if (nameChangedEvents.length > 0) {
        callbacks.onNameChange?.();
      }

      if (fundsReceivedEvents.length > 0) {
        callbacks.onFundsChange?.();
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
    <>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
        <h3 style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'lighter', letterSpacing: '0.0618rem' }}>
          Recent Activity
        </h3>
      </div>

      {eventFeed.map((event, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '1rem',
            marginTop: '1rem',
            borderRadius: '20px',
            background: '#333333',
            padding: '1rem 1rem 0.5rem 1rem',
            rowGap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
            <p
              style={{
                color: '#FAFAFA',
                margin: '0',
                alignContent: 'center',
                fontFamily: 'Arial, sans-serif',
                fontSize: '1rem',
                fontWeight: 'bold',
              }}
            >
              {event.title}
            </p>
            <p style={{ fontFamily: 'monospace', color: '#FAFAFA', margin: '0', fontSize: '0.8rem' }}>
              {timeInPast(blockNumber, event.blockNumber)} ago
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
            {event.primary && (
              <Identity address={event.primary} hasCopyAddressOnClick={true}>
                <Avatar />
                <Name />
                <Badge />
                <IdentityAddress />
              </Identity>
            )}
          </div>
          {event.secondary && (
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
              <p
                style={{
                  color: '#FAFAFA',
                  marginRight: '0.5rem',
                  alignContent: 'center',
                  fontWeight: 'bold',
                  fontFamily: 'Arial, sans-serif',
                }}
              >
                By
              </p>
              <Identity address={event.secondary} hasCopyAddressOnClick={true}>
                <Avatar />
                <Name />
                <Badge />
                <IdentityAddress />
              </Identity>
            </div>
          )}
          {event.message && (
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignContent: 'center' }}>
              <p
                style={{
                  color: '#FAFAFA',
                  marginRight: '0.5rem',
                  alignContent: 'center',
                  fontWeight: 'bold',
                  fontFamily: 'Arial, sans-serif',
                }}
              >
                Message
              </p>
              <p style={{ color: '#F6F1D5', marginLeft: '0.5rem', alignContent: 'center', fontFamily: 'Arial, sans-serif' }}>
                {event.message}
              </p>
            </div>
          )}
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
    </>
  )
}

export default EventFeed