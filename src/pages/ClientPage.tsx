import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useWalletClient } from 'wagmi'
import { erc20Abi, parseUnits } from 'viem'
import { ReceiptText, CreditCard, PlusCircle, Clock, XCircle, ChevronDown, ChevronUp, Copy, Check, Zap } from 'lucide-react'
import { AGENT_TAB_ADDRESS, AGENT_TAB_ABI } from '../contract'
import { ARC_TESTNET_ID, displayUsdc, parseOnchainError, signReceipt, formatCountdown, type SignedReceipt } from '../utils'
import { useServiceCount, useTabCount, useAllServices, useAllTabs } from '../hooks/useAgentTab'
import { TxButton } from '../components/TxButton'
import { TxStatus } from '../components/TxStatus'
import { getUsdc } from '@/onchain-facts'

const USDC = getUsdc(ARC_TESTNET_ID)!

// ─── Open Tab Card ─────────────────────────────────────────────────────────────

interface OpenTabCardProps {
  serviceId: number
  serviceName: string
  pricePerCall: bigint
  onOpened: () => void
  onCancel: () => void
}

function OpenTabCard({ serviceId, serviceName, pricePerCall, onOpened, onCancel }: OpenTabCardProps) {
  const [amountStr, setAmountStr] = useState('')
  const { address } = useAccount()

  const amountRaw = amountStr ? (() => {
    try { return parseUnits(amountStr, 6) } catch { return null }
  })() : null

  const { writeContract: approve, data: approveHash, isPending: isApprovePending, isError: isApproveError, error: approveError, reset: resetApprove } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContract: openTab, data: openHash, isPending: isOpenPending, isError: isOpenError, error: openError, reset: resetOpen } = useWriteContract()
  const { isLoading: isOpenConfirming, isSuccess: isOpenSuccess } = useWaitForTransactionReceipt({ hash: openHash })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address ?? '0x0000000000000000000000000000000000000000', AGENT_TAB_ADDRESS],
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const isApproved = amountRaw !== null && allowance !== undefined && (allowance) >= amountRaw
  const calls = amountRaw !== null && pricePerCall > 0n ? amountRaw / pricePerCall : null

  useEffect(() => {
    if (isApproveSuccess) void refetchAllowance()
  }, [isApproveSuccess, refetchAllowance])

  useEffect(() => {
    if (isOpenSuccess) onOpened()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpenSuccess])

  function handleApprove() {
    if (!amountRaw) return
    resetApprove()
    approve({ address: USDC.address as `0x${string}`, abi: erc20Abi, functionName: 'approve', args: [AGENT_TAB_ADDRESS, amountRaw], chainId: ARC_TESTNET_ID })
  }
  function handleOpen() {
    if (!amountRaw) return
    resetOpen()
    openTab({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'openTab', args: [BigInt(serviceId), amountRaw], chainId: ARC_TESTNET_ID })
  }

  return (
    <div className="card border-2 border-[var(--accent)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--ink)]">Open tab — {serviceName}</h3>
        <button onClick={onCancel} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"><XCircle size={18} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="label">Deposit amount</label>
          <div className="relative">
            <input className="input pr-14" type="number" min="0" step="0.01" placeholder="10.00" value={amountStr} onChange={e => setAmountStr(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] font-mono">USDC</span>
          </div>
        </div>
        {amountRaw !== null && amountRaw > 0n && (
          <div className="preview-row">
            <span>{pricePerCall > 0n ? '~calls prepaid' : 'Price per call'}</span>
            {pricePerCall > 0n && calls !== null
              ? <span className="tabular-nums font-semibold text-[var(--ink)]">{calls.toString()}</span>
              : <span className="text-[var(--success)] font-semibold">Free</span>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {!isApproved ? (
            <TxButton
              label="Allow USDC"
              pendingLabel="Confirm in wallet…"
              confirmingLabel="Approving…"
              disabled={!amountRaw || amountRaw === 0n}
              isPending={isApprovePending}
              isConfirming={isApproveConfirming}
              isSuccess={isApproveSuccess}
              onClick={handleApprove}
              className="flex-1"
            />
          ) : (
            <TxButton
              label="Open Tab"
              pendingLabel="Confirm in wallet…"
              confirmingLabel="Opening…"
              disabled={!amountRaw || amountRaw === 0n}
              isPending={isOpenPending}
              isConfirming={isOpenConfirming}
              isSuccess={isOpenSuccess}
              onClick={handleOpen}
              className="flex-1"
            />
          )}
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
        <TxStatus isSuccess={isApproveSuccess} isError={isApproveError} error={approveError} hash={approveHash} successMessage="USDC approved — now open the tab." />
        <TxStatus isSuccess={isOpenSuccess} isError={isOpenError} error={openError} hash={openHash} successMessage="Tab opened!" />
      </div>
    </div>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handleCopy} className="p-1.5 rounded hover:bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors" title="Copy">
      {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
    </button>
  )
}

// ─── Tab Card (V2) ────────────────────────────────────────────────────────────

interface TabCardProps {
  tabId: number
  client: string
  balance: bigint
  callsClaimed: bigint
  closed: boolean
  closeRequestedAt: bigint
  serviceName: string
  pricePerCall: bigint
  closeDelay: bigint
  onChanged: () => void
}

function TabCard({ tabId, client, balance, callsClaimed, closed, closeRequestedAt, serviceName, pricePerCall, closeDelay, onChanged }: TabCardProps) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [expanded, setExpanded] = useState(false)
  const [callsStr, setCallsStr] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [receipts, setReceipts] = useState<SignedReceipt[]>([])
  const [sigError, setSigError] = useState('')
  const [isSigning, setIsSigning] = useState(false)

  const isClosing = closeRequestedAt > 0n && !closed
  const closeAfterTs = Number(closeRequestedAt) + Number(closeDelay)

  // Computed in render but depends only on closeAfterTs, refreshed by ticker
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (isClosing) {
      tickRef.current = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [isClosing])

  const canFinalize = isClosing && nowSec >= closeAfterTs

  // top-up allow
  const { writeContract: approve, data: approveHash, isPending: isApprovePending, isError: isApproveError, error: approveError, reset: resetApprove } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { writeContract: topUp, data: topUpHash, isPending: isTopUpPending, isError: isTopUpError, error: topUpError, reset: resetTopUp } = useWriteContract()
  const { isLoading: isTopUpConfirming, isSuccess: isTopUpSuccess } = useWaitForTransactionReceipt({ hash: topUpHash })

  // close flow
  const { writeContract: requestClose, data: reqHash, isPending: isReqPending, isError: isReqError, error: reqError, reset: resetReq } = useWriteContract()
  const { isLoading: isReqConfirming, isSuccess: isReqSuccess } = useWaitForTransactionReceipt({ hash: reqHash })
  const { writeContract: finalizeClose, data: finHash, isPending: isFinPending, isError: isFinError, error: finError, reset: resetFin } = useWriteContract()
  const { isLoading: isFinConfirming, isSuccess: isFinSuccess } = useWaitForTransactionReceipt({ hash: finHash })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address ?? '0x0000000000000000000000000000000000000000', AGENT_TAB_ADDRESS],
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const amountRaw = amountStr ? (() => { try { return parseUnits(amountStr, 6) } catch { return null } })() : null
  const isApprovedForTopUp = amountRaw !== null && allowance !== undefined && (allowance) >= amountRaw

  useEffect(() => { if (isApproveSuccess) void refetchAllowance() }, [isApproveSuccess, refetchAllowance])
  useEffect(() => { if (isTopUpSuccess) { onChanged() } }, [isTopUpSuccess, onChanged])
  useEffect(() => { if (isReqSuccess) { onChanged() } }, [isReqSuccess, onChanged])
  useEffect(() => { if (isFinSuccess) { onChanged() } }, [isFinSuccess, onChanged])

  // ── Sign a receipt ──
  async function handleSign() {
    if (!walletClient) { setSigError('Wallet not available.'); return }
    const n = parseInt(callsStr, 10)
    if (isNaN(n) || n <= 0) { setSigError('Enter a positive number of calls.'); return }
    const totalCalls = BigInt(n)
    if (totalCalls <= callsClaimed) { setSigError(`Total calls must be > ${callsClaimed.toString()} (already claimed).`); return }
    setSigError('')
    setIsSigning(true)
    try {
      const sig = await signReceipt(walletClient, BigInt(tabId), totalCalls)
      const receipt: SignedReceipt = { tabId, totalCalls: n, signature: sig, signedAt: Date.now() }
      setReceipts(prev => [...prev, receipt])
      setCallsStr('')
    } catch (e) {
      setSigError(parseOnchainError(e))
    } finally {
      setIsSigning(false)
    }
  }

  function handleRequestClose() {
    resetReq()
    requestClose({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'requestClose', args: [BigInt(tabId)], chainId: ARC_TESTNET_ID })
  }
  function handleFinalize() {
    resetFin()
    finalizeClose({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'finalizeClose', args: [BigInt(tabId)], chainId: ARC_TESTNET_ID })
  }
  function handleApproveTopUp() {
    if (!amountRaw) return
    resetApprove()
    approve({ address: USDC.address as `0x${string}`, abi: erc20Abi, functionName: 'approve', args: [AGENT_TAB_ADDRESS, amountRaw], chainId: ARC_TESTNET_ID })
  }
  function handleTopUp() {
    if (!amountRaw) return
    resetTopUp()
    topUp({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'topUp', args: [BigInt(tabId), amountRaw], chainId: ARC_TESTNET_ID })
  }

  const isOwn = address?.toLowerCase() === client.toLowerCase()
  const statusColor = closed ? 'text-[var(--muted)]' : isClosing ? 'text-amber-600' : 'text-[var(--success)]'
  const statusLabel = closed ? 'Closed' : isClosing ? (canFinalize ? 'Ready to finalize' : 'Closing') : 'Open'

  return (
    <div className={`card ${closed ? 'opacity-60' : ''}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-[var(--muted)]">Tab #{tabId}</span>
            <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
            {isClosing && !canFinalize && (
              <span className="text-xs text-amber-600 tabular-nums">{formatCountdown(closeAfterTs)}</span>
            )}
          </div>
          <div className="text-sm font-semibold text-[var(--ink)] truncate mt-0.5">{serviceName}</div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-center">
          <div className="text-xs text-[var(--muted)] mb-0.5">Balance</div>
          <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{displayUsdc(balance)}</div>
        </div>
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-center">
          <div className="text-xs text-[var(--muted)] mb-0.5">Claimed calls</div>
          <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{callsClaimed.toString()}</div>
        </div>
        <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-center">
          <div className="text-xs text-[var(--muted)] mb-0.5">Price/call</div>
          <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{pricePerCall === 0n ? 'Free' : displayUsdc(pricePerCall)}</div>
        </div>
      </div>

      {/* Expanded actions (owner only) */}
      {expanded && isOwn && !closed && (
        <div className="mt-4 space-y-4 pt-4 border-t border-[var(--border)]">

          {/* Sign a receipt */}
          <div>
            <div className="label mb-2 flex items-center gap-1.5"><Zap size={12} />Use service (sign receipt)</div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-[var(--muted)] mb-1 block">Total calls used so far (cumulative)</label>
                <input
                  className="input"
                  type="number"
                  min={Number(callsClaimed) + 1}
                  placeholder={`${Number(callsClaimed) + 1}`}
                  value={callsStr}
                  onChange={e => setCallsStr(e.target.value)}
                />
              </div>
              <TxButton
                label={isSigning ? 'Signing…' : 'Sign'}
                pendingLabel="Signing…"
                confirmingLabel="Signing…"
                disabled={isSigning || !callsStr}
                isPending={isSigning}
                isConfirming={false}
                isSuccess={false}
                onClick={() => { void handleSign() }}
              />
            </div>
            {sigError && <p className="text-xs text-[var(--danger)] mt-1">{sigError}</p>}
          </div>

          {/* Receipts list */}
          {receipts.length > 0 && (
            <div>
              <div className="label mb-2 flex items-center gap-1.5"><ReceiptText size={12} />Signed receipts</div>
              <div className="space-y-2">
                {receipts.map((r, i) => (
                  <div key={i} className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-[var(--ink)]">totalCalls = {r.totalCalls}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[var(--muted)]">{new Date(r.signedAt).toLocaleTimeString()}</span>
                        <CopyButton text={JSON.stringify({ tabId: r.tabId, totalCalls: r.totalCalls, signature: r.signature })} />
                      </div>
                    </div>
                    <div className="font-mono text-[var(--muted)] break-all leading-relaxed">{r.signature}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top-up (only when not closing) */}
          {!isClosing && (
            <div>
              <div className="label mb-2 flex items-center gap-1.5"><PlusCircle size={12} />Top up tab</div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <div className="relative">
                    <input className="input pr-14" type="number" min="0" step="0.01" placeholder="5.00" value={amountStr} onChange={e => setAmountStr(e.target.value)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] font-mono">USDC</span>
                  </div>
                </div>
                {!isApprovedForTopUp ? (
                  <TxButton label="Allow" pendingLabel="…" confirmingLabel="…" disabled={!amountRaw || amountRaw === 0n} isPending={isApprovePending} isConfirming={isApproveConfirming} isSuccess={isApproveSuccess} onClick={handleApproveTopUp} />
                ) : (
                  <TxButton label="Top up" pendingLabel="…" confirmingLabel="…" disabled={!amountRaw || amountRaw === 0n} isPending={isTopUpPending} isConfirming={isTopUpConfirming} isSuccess={isTopUpSuccess} onClick={handleTopUp} />
                )}
              </div>
              <TxStatus isSuccess={isApproveSuccess} isError={isApproveError} error={approveError} hash={approveHash} successMessage="Approved — now top up." />
              <TxStatus isSuccess={isTopUpSuccess} isError={isTopUpError} error={topUpError} hash={topUpHash} successMessage="Tab topped up!" />
            </div>
          )}

          {/* Close flow */}
          <div>
            <div className="label mb-2 flex items-center gap-1.5"><Clock size={12} />Close tab</div>
            {!isClosing ? (
              <>
                <p className="text-xs text-[var(--muted)] mb-2">Start a {Math.round(Number(closeDelay) / 60)}-minute close window. Provider can still claim during this period.</p>
                <TxButton label="Request close" pendingLabel="Confirm…" confirmingLabel="Requesting…" disabled={false} isPending={isReqPending} isConfirming={isReqConfirming} isSuccess={isReqSuccess} onClick={handleRequestClose} variant="ghost" />
                <TxStatus isSuccess={isReqSuccess} isError={isReqError} error={reqError} hash={reqHash} successMessage="Close requested! Wait for the timer before finalizing." />
              </>
            ) : (
              <>
                <p className="text-xs text-amber-600 mb-2">
                  {canFinalize
                    ? 'Delay elapsed — finalize to get your remaining balance back.'
                    : `Close window started. You can finalize in ${formatCountdown(closeAfterTs)}.`}
                </p>
                <TxButton
                  label="Finalize & refund"
                  pendingLabel="Confirm…"
                  confirmingLabel="Finalizing…"
                  disabled={!canFinalize}
                  isPending={isFinPending}
                  isConfirming={isFinConfirming}
                  isSuccess={isFinSuccess}
                  onClick={handleFinalize}
                />
                <TxStatus isSuccess={isFinSuccess} isError={isFinError} error={finError} hash={finHash} successMessage={`Tab closed. ${displayUsdc(balance)} refunded.`} />
              </>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Main Client Page ─────────────────────────────────────────────────────────

export default function ClientPage() {
  const { address } = useAccount()
  const [openingForService, setOpeningForService] = useState<number | null>(null)

  const { data: rawServiceCount, refetch: refetchServiceCount } = useServiceCount()
  const { data: rawTabCount, refetch: refetchTabCount } = useTabCount()
  const { data: rawCloseDelay } = useReadContract({ address: AGENT_TAB_ADDRESS, abi: AGENT_TAB_ABI, functionName: 'CLOSE_DELAY', chainId: ARC_TESTNET_ID })

  const serviceCount = Number(rawServiceCount ?? 0n)
  const tabCount = Number(rawTabCount ?? 0n)
  const closeDelay = (rawCloseDelay) ?? 600n

  const { data: servicesRaw, refetch: refetchServices } = useAllServices(serviceCount)
  const { data: tabsRaw, refetch: refetchTabs } = useAllTabs(tabCount)

  const refetchAll = useCallback(() => {
    void refetchServiceCount()
    void refetchTabCount()
    void refetchServices()
    void refetchTabs()
  }, [refetchServiceCount, refetchTabCount, refetchServices, refetchTabs])

  const services = (servicesRaw ?? []).map((r, i) => {
    if (r.status !== 'success' || !r.result) return null
    const [provider, name, pricePerCall] = r.result as [string, string, bigint]
    return { id: i, provider, name, pricePerCall }
  }).filter(Boolean) as { id: number; provider: string; name: string; pricePerCall: bigint }[]

  const myTabs = (tabsRaw ?? []).map((r, i) => {
    if (r.status !== 'success' || !r.result) return null
    // Compiled struct order: client, refundRecipient, serviceId, balance, callsClaimed, closed, closeRequestedAt
    const result = r.result as readonly [string, string, bigint, bigint, bigint, boolean, bigint]
    const [client, , serviceId, balance, callsClaimed, closed, closeRequestedAt] = result
    return { id: i, client, serviceId: Number(serviceId), balance, callsClaimed, closed, closeRequestedAt }
  }).filter(Boolean).filter(t => t !== null && t.client.toLowerCase() === (address ?? '').toLowerCase()) as {
    id: number; client: string; serviceId: number; balance: bigint; callsClaimed: bigint; closed: boolean; closeRequestedAt: bigint
  }[]

  return (
    <div className="space-y-6">
      {/* Services */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
          <CreditCard size={18} className="text-[var(--accent)]" />
          Services
        </h2>
        {serviceCount === 0 ? (
          <div className="card text-center text-[var(--muted)] text-sm py-8">No services registered yet.</div>
        ) : (
          <div className="space-y-2">
            {services.map(s => (
              <div key={s.id} className="card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--ink)] truncate">{s.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {s.pricePerCall === 0n ? 'Free' : `${displayUsdc(s.pricePerCall)} / call`}
                  </div>
                </div>
                {openingForService === s.id ? null : (
                  <button
                    onClick={() => setOpeningForService(s.id)}
                    className="btn-primary text-sm flex-shrink-0"
                  >
                    Open tab
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {openingForService !== null && (() => {
          const svc = services.find(s => s.id === openingForService)
          if (!svc) return null
          return (
            <div className="mt-3">
              <OpenTabCard
                serviceId={svc.id}
                serviceName={svc.name}
                pricePerCall={svc.pricePerCall}
                onOpened={() => { setOpeningForService(null); refetchAll() }}
                onCancel={() => setOpeningForService(null)}
              />
            </div>
          )
        })()}
      </section>

      {/* My Tabs */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
          <ReceiptText size={18} className="text-[var(--accent)]" />
          My Tabs
        </h2>
        {myTabs.length === 0 ? (
          <div className="card text-center text-[var(--muted)] text-sm py-8">No tabs yet. Open one above.</div>
        ) : (
          <div className="space-y-3">
            {myTabs.map(t => {
              const svc = services.find(s => s.id === t.serviceId)
              return (
                <TabCard
                  key={t.id}
                  tabId={t.id}
                  client={t.client}
                  balance={t.balance}
                  callsClaimed={t.callsClaimed}
                  closed={t.closed}
                  closeRequestedAt={t.closeRequestedAt}
                  serviceName={svc?.name ?? `Service #${t.serviceId}`}
                  pricePerCall={svc?.pricePerCall ?? 0n}
                  closeDelay={closeDelay}
                  onChanged={refetchAll}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
