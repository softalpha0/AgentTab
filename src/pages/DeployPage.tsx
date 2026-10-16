/**
 * Hidden deploy page — navigate to /#/deploy to access.
 * Deploys AgentTabV2 to Arc mainnet from the connected wallet.
 *
 * Arc mainnet (docs.arc.io):
 *   Chain ID : 5042
 *   RPC      : https://rpc.mainnet.arc.io
 *   Explorer : https://explorer.arc.io
 *   USDC     : 0x3600000000000000000000000000000000000000
 *   CLOSE_DELAY passed: 3600 (1 hour)
 */

import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain, usePublicClient, useWalletClient } from 'wagmi'
import { encodeDeployData } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { CheckCircle, AlertTriangle, Loader, ExternalLink, Copy, Check } from 'lucide-react'
import { AGENT_TAB_ABI } from '../contract'
import { ARC_MAINNET_ID } from '../utils'
import { arc } from '../config'

// ─── Bytecode from the compiled Foundry artifact ─────────────────────────────
// Re-generate with `forge build` if you modify AgentTabV2.sol.
import { AGENT_TAB_V2_BYTECODE as BYTECODE } from '../agentTabBytecode'

// Constructor args: (address usdcAddress, uint256 closeDelay)
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
const CLOSE_DELAY = 3600n  // 1 hour

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
    >
      {copied ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ─── Post-deploy verification reads ──────────────────────────────────────────
interface VerifyResult {
  usdc: string
  closeDelay: bigint
}

async function verifyDeploy(
  publicClient: ReturnType<typeof usePublicClient>,
  address: `0x${string}`,
): Promise<VerifyResult> {
  if (!publicClient) throw new Error('No public client')

  const [usdcRaw, closeDelayRaw] = await Promise.all([
    publicClient.readContract({
      address,
      abi: AGENT_TAB_ABI,
      functionName: 'usdc',
    }),
    publicClient.readContract({
      address,
      abi: AGENT_TAB_ABI,
      functionName: 'CLOSE_DELAY',
    }),
  ])

  return {
    usdc: usdcRaw,
    closeDelay: closeDelayRaw,
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
type Phase =
  | 'idle'
  | 'switching'
  | 'deploying'
  | 'confirming'
  | 'verifying'
  | 'done'
  | 'error'

export default function DeployPage() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: ARC_MAINNET_ID })
  const { data: walletClient } = useWalletClient()

  const [phase, setPhase] = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [deployedAddress, setDeployedAddress] = useState<`0x${string}` | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  const isOnMainnet = chainId === ARC_MAINNET_ID

  // Auto-read verification once address lands
  useEffect(() => {
    if (!deployedAddress || !publicClient || phase !== 'verifying') return
    verifyDeploy(publicClient, deployedAddress)
      .then(r => { setVerifyResult(r); setPhase('done') })
      .catch(e => { setErrorMsg(String(e)); setPhase('error') })
  }, [deployedAddress, publicClient, phase])

  async function handleDeploy() {
    setErrorMsg('')
    try {
      // 1. Switch to Arc mainnet if needed
      if (!isOnMainnet) {
        setPhase('switching')
        await switchChainAsync({ chainId: ARC_MAINNET_ID })
      }

      if (!walletClient) throw new Error('Wallet client not available after chain switch.')

      // 2. Send the deploy transaction
      setPhase('deploying')
      const deployData = encodeDeployData({
        abi: AGENT_TAB_ABI,
        bytecode: BYTECODE,
        args: [USDC_ADDRESS, CLOSE_DELAY],
      })

      const [account] = await walletClient.getAddresses()
      if (!account) throw new Error('No account connected.')

      const hash = await walletClient.sendTransaction({
        account,
        data: deployData,
        chain: arc,
      })
      setTxHash(hash)
      setPhase('confirming')

      // 3. Wait for the receipt
      if (!publicClient) throw new Error('No public client for Arc mainnet.')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (!receipt.contractAddress) throw new Error('No contract address in receipt — deploy may have failed.')

      setDeployedAddress(receipt.contractAddress)
      setPhase('verifying')
    } catch (e) {
      const msg = (e as { shortMessage?: string; message?: string })?.shortMessage
        ?? (e as { message?: string })?.message
        ?? 'Unknown error'
      setErrorMsg(msg)
      setPhase('error')
    }
  }

  const explorerBase = arc.blockExplorers.default.url

  return (
    <div className="min-h-dvh bg-[var(--bg)] bg-[image:var(--bg-gradient)]">
      <div className="max-w-xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold mb-4">
            <AlertTriangle size={12} />
            Mainnet deployment — real USDC
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink)] display tracking-tight mb-2">
            Deploy AgentTabV2 to Arc Mainnet
          </h1>
          <p className="text-[var(--muted)] text-sm">
            This page deploys from your connected wallet. Review the parameters below before proceeding.
          </p>
        </div>

        {/* Parameters card */}
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Deploy parameters</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center gap-4">
              <span className="text-[var(--muted)]">Network</span>
              <span className="font-mono text-[var(--ink)] font-semibold">Arc Mainnet (chainId 5042)</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[var(--muted)]">USDC address</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-[var(--ink)]">0x3600…0000</span>
                <CopyButton text={USDC_ADDRESS} />
              </div>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[var(--muted)]">CLOSE_DELAY</span>
              <span className="font-mono text-[var(--ink)]">3600s (1 hour)</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[var(--muted)]">RPC</span>
              <span className="font-mono text-xs text-[var(--muted)]">rpc.mainnet.arc.io</span>
            </div>
          </div>
        </div>

        {/* Connect / deploy button area */}
        {!isConnected ? (
          <div className="card text-center py-8">
            <p className="text-[var(--muted)] text-sm mb-4">Connect your wallet to deploy.</p>
            <ConnectKitButton />
          </div>
        ) : phase === 'done' && deployedAddress ? (
          /* ── Success state ── */
          <div className="space-y-4">
            <div className="card border border-[var(--success)]">
              <div className="flex items-center gap-2 mb-4 text-[var(--success)]">
                <CheckCircle size={18} />
                <span className="font-semibold">Deployed successfully</span>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Contract address</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[var(--ink)] font-semibold break-all">{deployedAddress}</span>
                    <CopyButton text={deployedAddress} />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[var(--muted)] mb-1">Explorer</div>
                  <a
                    href={`${explorerBase}/address/${deployedAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline font-mono text-xs"
                  >
                    explorer.arc.io/address/{deployedAddress.slice(0, 10)}…
                    <ExternalLink size={11} />
                  </a>
                </div>

                {txHash && (
                  <div>
                    <div className="text-xs text-[var(--muted)] mb-1">Tx hash</div>
                    <a
                      href={`${explorerBase}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline font-mono text-xs"
                    >
                      {txHash.slice(0, 18)}…
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}

                {verifyResult && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                    <div className="text-xs font-semibold text-[var(--ink)] mb-1">On-chain reads (verified)</div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">usdc()</span>
                      <span className="font-mono text-xs text-[var(--ink)]">{verifyResult.usdc}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted)]">CLOSE_DELAY()</span>
                      <span className="font-mono text-xs text-[var(--ink)]">{verifyResult.closeDelay.toString()}s</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions for wiring it into the app */}
            <div className="card bg-[var(--surface-muted)]">
              <div className="text-xs font-semibold text-[var(--ink)] mb-2">Next step: activate mainnet in the app</div>
              <p className="text-xs text-[var(--muted)] mb-3">
                Open <code className="text-[var(--ink)]">src/contract.ts</code> and set:
              </p>
              <pre className="text-xs font-mono text-[var(--ink)] bg-white rounded-lg p-3 border border-[var(--border)] overflow-auto">
{`export const AGENT_TAB_MAINNET_ADDRESS: \`0x\${string}\` | null =\n  '${deployedAddress}'`}
              </pre>
              <div className="mt-2">
                <CopyButton
                  text={`export const AGENT_TAB_MAINNET_ADDRESS: \`0x\${string}\` | null =\n  '${deployedAddress}'`}
                  label="Copy snippet"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ── Pre-deploy / in-progress state ── */
          <div className="space-y-4">
            {/* Chain status */}
            {isConnected && (
              <div className={`card text-sm flex items-center gap-2 ${isOnMainnet ? 'border border-[var(--success)]' : 'border border-amber-300'}`}>
                {isOnMainnet ? (
                  <>
                    <CheckCircle size={15} className="text-[var(--success)] flex-shrink-0" />
                    <span className="text-[var(--success)] font-semibold">Connected to Arc Mainnet</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                    <span className="text-amber-700">
                      Wallet is on chain {chainId}, not Arc Mainnet (5042).
                      The deploy button will request a switch automatically.
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Phase status */}
            {phase !== 'idle' && phase !== 'error' && (
              <div className="card flex items-center gap-3 text-sm">
                <Loader size={16} className="animate-spin text-[var(--accent)] flex-shrink-0" />
                <span className="text-[var(--ink)]">
                  {phase === 'switching' && 'Requesting chain switch to Arc Mainnet…'}
                  {phase === 'deploying' && 'Confirm the deployment transaction in your wallet…'}
                  {phase === 'confirming' && 'Waiting for transaction confirmation…'}
                  {phase === 'verifying' && 'Reading deployed contract…'}
                </span>
                {txHash && phase === 'confirming' && (
                  <a
                    href={`${explorerBase}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[var(--accent)] hover:underline flex items-center gap-1 text-xs flex-shrink-0"
                  >
                    View tx <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {/* Error */}
            {phase === 'error' && errorMsg && (
              <div className="card border border-[var(--danger)] text-sm text-[var(--danger)]">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle size={14} /> Deploy failed
                </div>
                <p className="text-xs break-words">{errorMsg}</p>
              </div>
            )}

            {/* Deploy button */}
            <button
              onClick={() => { void handleDeploy() }}
              disabled={phase !== 'idle' && phase !== 'error'}
              className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isOnMainnet ? 'Switch to Arc Mainnet & Deploy' : 'Deploy to Arc Mainnet'}
            </button>

            <p className="text-xs text-[var(--muted)] text-center">
              Gas is paid in USDC. You need a small amount of USDC on Arc mainnet to cover fees.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
