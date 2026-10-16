import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { Plus, Zap, ChevronDown, ChevronUp, ReceiptText, X } from 'lucide-react'
import { AGENT_TAB_ADDRESS, AGENT_TAB_ABI } from '../contract'
import { ARC_MAINNET_ID, displayUsdc } from '../utils'
import { useServiceCount, useTabCount, useAllServices, useAllTabs } from '../hooks/useAgentTab'
import { TxButton } from '../components/TxButton'
import { TxStatus } from '../components/TxStatus'

// ─── Register Service Form ────────────────────────────────────────────────────

function RegisterServiceCard({ onRegistered }: { onRegistered: () => void }) {
  const [name, setName] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [localError, setLocalError] = useState('')

  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) onRegistered()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  function handleSubmit() {
    setLocalError('')
    reset()
    if (!name.trim()) { setLocalError('Name is required.'); return }
    const priceNum = parseFloat(priceStr)
    if (isNaN(priceNum) || priceNum < 0) { setLocalError('Enter a valid price (0 for free).'); return }
    const priceRaw = parseUnits(priceStr || '0', 6)
    writeContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'registerService', args: [name.trim(), priceRaw], chainId: ARC_MAINNET_ID })
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-[var(--ink)] mb-4">Register a Service</h2>
      <div className="space-y-3">
        <div>
          <label className="label">Service name</label>
          <input className="input" placeholder="GPT-4o Turbo API" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Price per call (USDC)</label>
          <div className="relative">
            <input className="input pr-14" type="number" min="0" step="0.000001" placeholder="0.01" value={priceStr} onChange={e => setPriceStr(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] font-mono">USDC</span>
          </div>
        </div>
        {localError && <p className="text-xs text-[var(--danger)]">{localError}</p>}
        <TxButton label="Register service" pendingLabel="Confirm in wallet…" confirmingLabel="Registering…" disabled={!name.trim()} isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} onClick={handleSubmit} />
        <TxStatus isSuccess={isSuccess} isError={isError} error={error} hash={hash} successMessage="Service registered!" />
      </div>
    </div>
  )
}

// ─── Claim Form (V2: signature required) ────────────────────────────────────

interface ClaimFormProps {
  tabId: number
  callsClaimed: bigint
  pricePerCall: bigint
  balance: bigint
  onClaimed: () => void
  onCancel: () => void
}

function ClaimForm({ tabId, callsClaimed, pricePerCall, balance, onClaimed, onCancel }: ClaimFormProps) {
  const [totalCallsStr, setTotalCallsStr] = useState('')
  const [sigStr, setSigStr] = useState('')
  const [localError, setLocalError] = useState('')

  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (isSuccess) onClaimed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  const totalCalls = parseInt(totalCallsStr, 10)
  const isValidTotal = !isNaN(totalCalls) && totalCalls > 0
  const newCalls = isValidTotal ? BigInt(totalCalls) - callsClaimed : 0n
  const claimAmount = newCalls > 0n ? newCalls * pricePerCall : 0n
  const isValidSig = sigStr.trim().startsWith('0x') && sigStr.trim().length > 10

  function handleClaim() {
    setLocalError('')
    reset()
    if (!isValidTotal || BigInt(totalCalls) <= callsClaimed) {
      setLocalError(`totalCalls must be > ${callsClaimed.toString()} (already claimed).`)
      return
    }
    if (!isValidSig) {
      setLocalError('Paste the hex signature from the client.')
      return
    }
    if (claimAmount > balance) {
      setLocalError(`Claim amount (${displayUsdc(claimAmount)}) exceeds tab balance (${displayUsdc(balance)}).`)
      return
    }
    writeContract({
      address: AGENT_TAB_ADDRESS,
      abi: AGENT_TAB_ABI,
      functionName: 'claim',
      args: [BigInt(tabId), BigInt(totalCalls), sigStr.trim() as `0x${string}`],
      chainId: ARC_MAINNET_ID,
    })
  }

  return (
    <div className="card border border-[var(--accent)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--ink)]">Claim from Tab #{tabId}</span>
        <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={16} /></button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="preview-row">
          <span>Already claimed</span>
          <span className="tabular-nums font-semibold text-[var(--ink)]">{callsClaimed.toString()} calls</span>
        </div>
        <div>
          <label className="label">Total calls (cumulative, from receipt)</label>
          <input className="input" type="number" min={Number(callsClaimed) + 1} placeholder={`${Number(callsClaimed) + 1}`} value={totalCallsStr} onChange={e => setTotalCallsStr(e.target.value)} />
        </div>
        {isValidTotal && BigInt(totalCalls) > callsClaimed && (
          <div className="preview-row">
            <span>New calls to claim</span>
            <span className="tabular-nums font-semibold text-[var(--ink)]">{newCalls.toString()} calls = {displayUsdc(claimAmount)}</span>
          </div>
        )}
        <div>
          <label className="label">Client signature (paste from client)</label>
          <textarea
            className="input font-mono text-xs leading-relaxed"
            rows={3}
            placeholder="0x..."
            value={sigStr}
            onChange={e => setSigStr(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
        {localError && <p className="text-xs text-[var(--danger)]">{localError}</p>}
        <TxButton label="Claim USDC" pendingLabel="Confirm…" confirmingLabel="Claiming…" disabled={!isValidTotal || !isValidSig} isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} onClick={handleClaim} />
        <TxStatus isSuccess={isSuccess} isError={isError} error={error} hash={hash} successMessage={`Claimed ${displayUsdc(claimAmount)}!`} />
      </div>
    </div>
  )
}

// ─── Provider Tab Card ───────────────────────────────────────────────────────

interface ProviderTabCardProps {
  tabId: number
  client: string
  balance: bigint
  callsClaimed: bigint
  closed: boolean
  closeRequestedAt: bigint
  serviceName: string
  pricePerCall: bigint
  onChanged: () => void
}

function ProviderTabCard({ tabId, client, balance, callsClaimed, closed, closeRequestedAt, serviceName, pricePerCall, onChanged }: ProviderTabCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showClaim, setShowClaim] = useState(false)

  // closeByProvider
  const { writeContract: closeByProvider, data: closeHash, isPending: isClosePending, isError: isCloseError, error: closeError, reset: resetClose } = useWriteContract()
  const { isLoading: isCloseConfirming, isSuccess: isCloseSuccess } = useWaitForTransactionReceipt({ hash: closeHash })

  useEffect(() => { if (isCloseSuccess) onChanged() }, [isCloseSuccess, onChanged])

  function handleCloseByProvider() {
    resetClose()
    closeByProvider({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'closeByProvider', args: [BigInt(tabId)], chainId: ARC_MAINNET_ID })
  }

  const isClosing = closeRequestedAt > 0n && !closed
  const statusLabel = closed ? 'Closed' : isClosing ? 'Closing' : 'Open'
  const statusColor = closed ? 'text-[var(--muted)]' : isClosing ? 'text-amber-600' : 'text-[var(--success)]'

  return (
    <div className={`card ${closed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[var(--muted)]">Tab #{tabId}</span>
            <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
          </div>
          <div className="text-sm font-semibold text-[var(--ink)] truncate mt-0.5">{serviceName}</div>
          <div className="text-xs text-[var(--muted)] font-mono truncate mt-0.5">{client}</div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-[var(--muted)] hover:text-[var(--ink)] flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-center">
          <div className="text-xs text-[var(--muted)] mb-0.5">Balance</div>
          <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{displayUsdc(balance)}</div>
        </div>
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-center">
          <div className="text-xs text-[var(--muted)] mb-0.5">Claimed</div>
          <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{callsClaimed.toString()} calls</div>
        </div>
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-center">
          <div className="text-xs text-[var(--muted)] mb-0.5">Price</div>
          <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{pricePerCall === 0n ? 'Free' : displayUsdc(pricePerCall)}</div>
        </div>
      </div>

      {expanded && !closed && (
        <div className="mt-4 space-y-3 pt-4 border-t border-[var(--border)]">
          {showClaim ? (
            <ClaimForm
              tabId={tabId}
              callsClaimed={callsClaimed}
              pricePerCall={pricePerCall}
              balance={balance}
              onClaimed={() => { setShowClaim(false); onChanged() }}
              onCancel={() => setShowClaim(false)}
            />
          ) : (
            <div className="flex gap-2">
              <button className="btn-primary text-sm flex-1" onClick={() => setShowClaim(true)}>
                Claim with receipt
              </button>
              <TxButton
                label="Close tab"
                pendingLabel="Confirm…"
                confirmingLabel="Closing…"
                disabled={false}
                isPending={isClosePending}
                isConfirming={isCloseConfirming}
                isSuccess={isCloseSuccess}
                onClick={handleCloseByProvider}
                variant="ghost"
              />
            </div>
          )}
          <TxStatus isSuccess={isCloseSuccess} isError={isCloseError} error={closeError} hash={closeHash} successMessage="Tab closed by provider. Remaining balance returned to client." />
        </div>
      )}
    </div>
  )
}

// ─── Main Provider Page ───────────────────────────────────────────────────────

export default function ProviderPage() {
  const { address } = useAccount()
  const [showRegister, setShowRegister] = useState(false)

  const { data: rawServiceCount, refetch: refetchServiceCount } = useServiceCount()
  const { data: rawTabCount, refetch: refetchTabCount } = useTabCount()

  const serviceCount = Number(rawServiceCount ?? 0n)
  const tabCount = Number(rawTabCount ?? 0n)

  const { data: servicesRaw, refetch: refetchServices } = useAllServices(serviceCount)
  const { data: tabsRaw, refetch: refetchTabs } = useAllTabs(tabCount)

  const refetchAll = useCallback(() => {
    void refetchServiceCount()
    void refetchTabCount()
    void refetchServices()
    void refetchTabs()
  }, [refetchServiceCount, refetchTabCount, refetchServices, refetchTabs])

  const myServices = (servicesRaw ?? []).map((r, i) => {
    if (r.status !== 'success' || !r.result) return null
    const [provider, name, pricePerCall] = r.result as [string, string, bigint]
    if (provider.toLowerCase() !== (address ?? '').toLowerCase()) return null
    return { id: i, provider, name, pricePerCall }
  }).filter(Boolean) as { id: number; provider: string; name: string; pricePerCall: bigint }[]

  const myServiceIds = new Set(myServices.map(s => s.id))

  const myTabs = (tabsRaw ?? []).map((r, i) => {
    if (r.status !== 'success' || !r.result) return null
    // Compiled struct order: client, refundRecipient, serviceId, balance, callsClaimed, closed, closeRequestedAt
    const result = r.result as readonly [string, string, bigint, bigint, bigint, boolean, bigint]
    const [client, , serviceId, balance, callsClaimed, closed, closeRequestedAt] = result
    if (!myServiceIds.has(Number(serviceId))) return null
    return { id: i, client, serviceId: Number(serviceId), balance, callsClaimed, closed, closeRequestedAt }
  }).filter(Boolean) as { id: number; client: string; serviceId: number; balance: bigint; callsClaimed: bigint; closed: boolean; closeRequestedAt: bigint }[]

  const totalPending = myTabs.reduce((acc, t) => acc + (!t.closed ? t.balance : 0n), 0n)

  return (
    <div className="space-y-6">
      {/* Stats */}
      {myServices.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <div className="text-xs text-[var(--muted)] mb-1">My services</div>
            <div className="text-2xl font-bold text-[var(--ink)]">{myServices.length}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs text-[var(--muted)] mb-1">Pending balance</div>
            <div className="text-2xl font-bold text-[var(--accent)]">{displayUsdc(totalPending)}</div>
          </div>
        </div>
      )}

      {/* Services */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[var(--ink)] flex items-center gap-2">
            <Zap size={18} className="text-[var(--accent)]" />
            My Services
          </h2>
          <button className="btn-ghost text-sm flex items-center gap-1.5" onClick={() => setShowRegister(v => !v)}>
            <Plus size={15} /> {showRegister ? 'Cancel' : 'New service'}
          </button>
        </div>

        {showRegister && (
          <div className="mb-3">
            <RegisterServiceCard onRegistered={() => { setShowRegister(false); refetchAll() }} />
          </div>
        )}

        {myServices.length === 0 && !showRegister ? (
          <div className="card text-center text-[var(--muted)] text-sm py-8">No services yet. Register one to get started.</div>
        ) : (
          <div className="space-y-2">
            {myServices.map(s => (
              <div key={s.id} className="card flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[var(--ink)]">{s.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {s.pricePerCall === 0n ? 'Free' : `${displayUsdc(s.pricePerCall)} / call`}
                  </div>
                </div>
                <span className="text-xs font-mono text-[var(--muted)]">#{s.id}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Tabs */}
      {myTabs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
            <ReceiptText size={18} className="text-[var(--accent)]" />
            Client Tabs
          </h2>
          <div className="space-y-3">
            {myTabs.map(t => {
              const svc = myServices.find(s => s.id === t.serviceId)
              return (
                <ProviderTabCard
                  key={t.id}
                  tabId={t.id}
                  client={t.client}
                  balance={t.balance}
                  callsClaimed={t.callsClaimed}
                  closed={t.closed}
                  closeRequestedAt={t.closeRequestedAt}
                  serviceName={svc?.name ?? `Service #${t.serviceId}`}
                  pricePerCall={svc?.pricePerCall ?? 0n}
                  onChanged={refetchAll}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
