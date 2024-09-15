import React, { useState, useEffect, ChangeEvent } from 'react'
import { useWalletClientContext } from './loader'
import { QRCodeSVG } from 'qrcode.react'
import { Address, isAddress, getContract, encodeDeployData, getAddress } from 'viem'
import { ERC20_ABI, USDC_ADDRESS, WETH_ADDRESS } from './constants'
import { MOONS_ABI, MOONS_BYTECODE } from './moons'
import { base } from 'viem/chains'
import SineWave from './sine'
import { AboutMoons, formatTokenBalance, getColorFromAddress } from './util'
import { EventFeed } from './EventFeed'
import { formatUSDC } from './util'
import { EventCallbacks } from './EventFeed'
import { ContractList } from './ContractList'
import { Identity, Avatar, Name, Badge, Address as IdentityAddress } from '@coinbase/onchainkit/identity'
import { Token, TokenChip, TokenSelectDropdown } from '@coinbase/onchainkit/token';
import { PRESET_TOKENS } from './constants'

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
  const [contractUsdcBalance, setContractUsdcBalance] = useState<bigint>(BigInt(0))
  const [admins, setAdmins] = useState<{[key: Address]: BigInt}>({})
  const [participants, setParticipants] = useState<{[key: Address]: bigint}>({})
  const [maximumAllowedDisbursement, setMaximumAllowedDisbursement] = useState<bigint>(BigInt(0))
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
  const [disbursmentError, setDisbursmentError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newName, setNewName] = useState(moonsName);
  const [newConstitution, setNewConstitution] = useState(moonsConstitution);
  const [adminMode, setAdminMode] = useState(false);
  const [disbursementMemo, setDisbursementMemo] = useState('');
  const [selectedToken, setSelectedToken] = useState<Token>(PRESET_TOKENS[0]);

  const tokenContract = getContract({ abi: ERC20_ABI, client: { public: publicClient }, address: selectedToken.address as Address });
  const moonsContract = getContract({ abi: MOONS_ABI, client: { public: publicClient }, address: selectedContract })

  const fetchName = () => {
    moonsContract.read.name().then(name => {
      setMoonsName(name as string)
      setNewName(name as string)
    })
  }

  const fetchConstitution = () => {
    moonsContract.read.constitution().then(constitution => {
      setMoonsConstitution(constitution as string)
      setNewConstitution(constitution as string)
    })
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
    tokenContract.read.balanceOf([selectedContract]).then(balance => setContractUsdcBalance(balance as bigint))
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
    if (address == '0x') return
    moonsContract.read.getNextAllowedDisburseTime([address]).then(time => {
      setNextAllowedDisburseTime(time as bigint)
    })
  }

  const fetchMaximumAllowedDisbursement = () => {
    if (address == '0x') return
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
      args: [USDC_ADDRESS, valueInMicroUSDC, disbursementMemo]
    });
    setShowDisbursementInput(false);
    setDisbursementValue('0');
    setDisbursementMemo('');
  };

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

  useEffect(() => {
    if (isAddress(selectedContract)) {
      window.location.hash = selectedContract;
    } else {
      window.location.hash = ''
    }
  }, [selectedContract]);

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
  }, [selectedContract, address, selectedToken])

  const myAddress: Address = address
  const myAdminRank = admins[address || '0x'] || BigInt(0);
  const isParticipant = participants[myAddress] ? true : false
  const cycleTimeNumber = Number(cycleTime)
  const participantCountNumber = Object.keys(participants).length
  const participantCount = BigInt(participantCountNumber)

  const nowSeconds = BigInt(Date.now()) / BigInt(1000)
  const mayDisburse = nextAllowedDisburseTime ? nowSeconds > nextAllowedDisburseTime : false
  const timeTillNextDisburse = nextAllowedDisburseTime - nowSeconds

  const getCycleLocation = (address: Address): [bigint, number, bigint] => {
    const rank = participants[address]
    if (!rank) return [BigInt(0), 0, BigInt(0)]
    if (!cycleTime) return [BigInt(0), 0, BigInt(0)]
    if (!participantCount) return [BigInt(0), 0, BigInt(0)]
    const totalDurationSeconds = nowSeconds - startTime
    const globalCycleNumber = totalDurationSeconds / cycleTime
    const globalCycleStart = startTime + (globalCycleNumber * cycleTime)
    const rankOffsetSeconds = ((rank - BigInt(1)) * cycleTime) / participantCount
    const addressCycleStart = globalCycleStart - rankOffsetSeconds
    const cycleMax = addressCycleStart + (cycleTime / BigInt(2))
    const phaseSeconds = (nowSeconds - startTime + rankOffsetSeconds) % cycleTime
    const phaseSecondsNumber = Number(phaseSeconds)
    const cycleRadians = cycleTimeNumber !== 0 ? (phaseSecondsNumber * 2 * Math.PI / cycleTimeNumber) : 0
    return [rankOffsetSeconds, cycleRadians, cycleMax]
  }

  const yourCycleLocation = getCycleLocation(myAddress)
  const yourCycleRadians = yourCycleLocation[1]
  const yourMarkers = isParticipant ? [{ radians: yourCycleRadians, color: "#007BFF", radius: 12}] : []
  const participantMarkers = Object.keys(participants).filter(addr => addr !== myAddress).map(addr => {
    const cycleLocation = getCycleLocation(addr as Address)
    return { radians: cycleLocation[1], color: getColorFromAddress(addr as Address), radius: 6 }
  })
  const markers = [ ...yourMarkers,  ...participantMarkers]

  const allowanceMaxRatio = 1 / Math.sqrt(participantCountNumber)
  const yourCycleMultiplier = participantCountNumber ? (Math.sin(yourCycleRadians / 2) ** 2) * allowanceMaxRatio : 0

  const formatTime = (totalSeconds: bigint) => {
    const days = totalSeconds / BigInt(86400)
    const hours = totalSeconds % BigInt(86400) / BigInt(3600)
    const minutes = totalSeconds % BigInt(3600) / BigInt(60)
    const seconds = totalSeconds % BigInt(60)
  
    const pad = (n: bigint) => n.toString().padStart(2, '0')
  
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
  }

  const getPhaseEmoji = (cycleRadians: number) => {
    const cyclePercentage = (cycleRadians / (2 * Math.PI)) * 100
  
    if (cyclePercentage < 2.5 || cyclePercentage >= 97.5) return "🌑"
    if (cyclePercentage < 12.5) return "🌒"
    if (cyclePercentage < 27.5) return "🌓"
    if (cyclePercentage < 47.5) return "🌔"
    if (cyclePercentage < 49.5) return "🌕"
    if (cyclePercentage < 50.5) return "🌝"
    if (cyclePercentage < 52.5) return "🌕"
    if (cyclePercentage < 72.5) return "🌖"
    if (cyclePercentage < 87.5) return "🌗"
    if (cyclePercentage < 97.5) return "🌘"
  
    return "🌑"
  }
  
  const yourCycleMaxTime = yourCycleLocation ? yourCycleLocation[2] : BigInt(0)
  const currentCycleMaxAgo = nowSeconds - yourCycleMaxTime
  const currentCycleMaxIn = yourCycleMaxTime - nowSeconds
  const timeFromMaxSeconds = yourCycleMaxTime > nowSeconds ? currentCycleMaxIn : currentCycleMaxAgo
  const timeAboutMaxString = yourCycleMaxTime > nowSeconds
    ? `${formatTime(timeFromMaxSeconds)} until max`
    : `${formatTime(timeFromMaxSeconds)} since max`
  
    const participantList = getSortedAddressesByRank(participants).map(addr => {
      return (
        <div key={`participant-${addr}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Identity
            address={addr}
            hasCopyAddressOnClick={true}
          >
            <Avatar />
            <Name />
            <Badge />
            <IdentityAddress />
          </Identity>
          {isAdmin && adminMode && (
            <button onClick={() => removeParticipant(addr)} style={{ cursor: 'pointer', marginLeft: '0.5rem' }}>
              🗑️
            </button>
          )}
        </div>
      );
    });
    

  const getPhaseLabel = (cycleRadians: number, currentTime: bigint, maxTime: bigint) => {
    const emoji = getPhaseEmoji(cycleRadians);
    const phaseLabel =
      cycleRadians < Math.PI * 0.05 || cycleRadians > Math.PI * 1.95
        ? "New Moon"
        : cycleRadians > Math.PI * 0.95 && cycleRadians < Math.PI * 1.05
        ? "Full Moon"
        : maxTime > currentTime
        ? "Waxing"
        : "Waning"
  
    return `${emoji} ${phaseLabel}`
  }

  const phaseLabel = getPhaseLabel(
    yourCycleRadians,
    nowSeconds,
    yourCycleMaxTime
  )
  
  const adminList = getSortedAddressesByRank(admins).map(addr => {
    return (
      <div key={`admin-${addr}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Identity address={addr} hasCopyAddressOnClick={true}>
          <Avatar />
          <Name />
          <Badge />
          <IdentityAddress />
        </Identity>
        {isAdmin && adminMode && (admins[addr] <= myAdminRank) && (
          <button onClick={() => removeAdmin(addr)} style={{ cursor: 'pointer', marginLeft: '0.5rem' }}>
            🗑️
          </button>
        )}
      </div>
    );
  });

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

  const eventCallbacks: EventCallbacks = {
    onAdminChange: () => {
      fetchAdmins();
    },
    onParticipantChange: () => {
      fetchParticipants();
      fetchMaximumAllowedDisbursement();
      fetchNextAllowedDisburseTime();
    },
    onFundsChange: () => {
      fetchMoonsUsdcBalance();
      fetchMaximumAllowedDisbursement();
      fetchNextAllowedDisburseTime();
    },
    onConstitutionChange: () => {
      fetchConstitution();
    },
    onNameChange: () => {
      fetchName();
    }
  };

  return (
    <div className='moons-app' style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', width: '100%', maxWidth: '42rem', alignSelf: 'center' }}>
      {adminMode && (
        <div
          style={{
            textAlign: 'center',
            margin: '1rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '0.5rem',
            borderRadius: '4px',
          }}
        >
          <label>
            Admin Mode is ON
            <input
              type="checkbox"
              checked={adminMode}
              onChange={() => setAdminMode(!adminMode)}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
        </div>
      )}
      {address === '0x' && <h4 style={{ fontWeight: 'lighter', color: '#e8eced', fontSize: '1rem', margin: '0', marginTop: '0.5rem', marginLeft: '1rem' }}>Connect a wallet to interact with this contract</h4>}
      {!isParticipant && address !== '0x' && <h4 style={{ fontWeight: 'lighter', color: '#e8eced', fontSize: '1rem', margin: '0', marginTop: '0.5rem', marginLeft: '1rem'}}>You are not currently a participant of this contract</h4>}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', marginRight: '1rem' }}>
          <QRCodeSVG
            value={getAddress(selectedContract)}
            onClick={() => copyToClipboard(selectedContract)}
            fgColor="#FFEBB9"
            bgColor="#000000"
          />
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
              {moonsName}
              {isAdmin && adminMode && <button onClick={() => setIsEditingName(true)} style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>✏️</button>}
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
              {moonsConstitution}
              {isAdmin && adminMode && <button onClick={() => setIsEditingDescription(true)} style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>✏️</button>}
            </h3>
          )}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontFamily: 'monospace', fontSize: '2rem', margin: '0', color: '#FFEBB9' }}>
              {formatTokenBalance(contractUsdcBalance, selectedToken.decimals)}
            </h1>
            <TokenSelectDropdown token={selectedToken} setToken={setSelectedToken} options={PRESET_TOKENS} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', padding: '1rem'}}>
        {isParticipant && <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '1.3rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{phaseLabel}</h4>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{timeAboutMaxString}</h4>
        </div>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>T = {(cycleTimeNumber / (3600 * 24)).toFixed(2)} days</h4>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'monospace', margin: '0', marginTop: '0.5rem' }}>{`Max = ${(allowanceMaxRatio*100).toFixed(2)}%`}</h4>
        </div>
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
                    <input
                      type="text"
                      placeholder="Memo"
                      value={disbursementMemo}
                      onChange={(e) => setDisbursementMemo(e.target.value)}
                      style={{ marginRight: '0.5rem', marginTop: '0.5rem' }}
                    />
                    <button
                      onClick={disburseFunds}
                      style={{ marginRight: '0.5rem', marginTop: '0.5rem' }}
                      disabled={!!disbursmentError || !disbursementValue}
                    >
                      Disburse
                    </button>
                    <button
                      onClick={() => {
                        setShowDisbursementInput(false);
                        setDisbursementMemo('');
                      }}
                      style={{ marginRight: '0.5rem', marginTop: '0.5rem' }}
                    >
                      Cancel
                    </button>
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
          <EventFeed selectedContract={selectedContract} callbacks={eventCallbacks} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', padding: '1rem'}}>
          <h3 style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'lighter', letterSpacing: '0.0618rem' }}>
            Participants
            {isAdmin && adminMode && !showAddParticipant && (
              <button onClick={() => setShowAddParticipant(true)} style={{ marginLeft: '0.5rem' }}>+</button>
            )}
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
          <div style={{ display: 'flex', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'space-evenly', gap: '0.5rem' }}>
            {participantList}
          </div>
          
          <h3 style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'lighter', letterSpacing: '0.0618rem' }}>
            Administrators
            {isAdmin && adminMode && !showAddAdmin && <button onClick={() => setShowAddAdmin(true)} style={{ marginLeft: '0.5rem' }}>+</button>}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly', gap: '0.5rem' }}>
            {adminList}
          </div>
        </div>
        {isAdmin && (
          <div style={{ textAlign: 'center', margin: '1rem' }}>
            <label>
              Admin Mode:
              <input
                type="checkbox"
                checked={adminMode}
                onChange={() => setAdminMode(!adminMode)}
              />
            </label>
          </div>
        )}
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

export default App
