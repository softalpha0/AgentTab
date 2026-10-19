import { useState, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { Zap, CreditCard, AlertTriangle } from 'lucide-react'
import ProviderPage from './pages/ProviderPage'
import ClientPage from './pages/ClientPage'
import LandingPage from './pages/LandingPage'
import { arc } from './config'

const ARC_MAINNET_ID = arc.id  // 5042

// ---------------------------------------------------------------------------
// Hash router
// ---------------------------------------------------------------------------

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return hash
}

// ---------------------------------------------------------------------------
// App shell (/#/app only — /#/deploy redirects here)
// ---------------------------------------------------------------------------

type Tab = 'client' | 'provider'

function AppShell() {
  const hash = useHash()
  const tab: Tab = hash.startsWith('#/app/provider') ? 'provider' : 'client'
  const [manualTab, setManualTab] = useState<Tab | null>(null)
  const activeTab: Tab = (hash === '#/app' && manualTab) ? manualTab : tab

  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const isWrongNetwork = isConnected && chainId !== ARC_MAINNET_ID

  return (
    <div className="min-h-dvh bg-[var(--bg)] bg-[image:var(--bg-gradient)]">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-[var(--ink)] tracking-tight display text-base">AgentTab</span>
          </a>
          <ConnectKitButton />
        </div>

        {/* Role tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1 p-1 bg-[var(--surface-muted)] rounded-xl">
            <button
              onClick={() => { setManualTab('client'); window.location.hash = '/app' }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'client'
                  ? 'bg-white shadow-sm text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
              }`}
            >
              <CreditCard size={14} />
              Client
            </button>
            <button
              onClick={() => { setManualTab('provider'); window.location.hash = '/app' }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'provider'
                  ? 'bg-white shadow-sm text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
              }`}
            >
              <Zap size={14} />
              Provider
            </button>
          </div>
        </div>
      </header>

      {/* Wrong-network banner */}
      {isWrongNetwork && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
              <AlertTriangle size={16} className="shrink-0" />
              Wrong network — this app runs on Arc Mainnet only
            </div>
            <button
              onClick={() => switchChain({ chainId: ARC_MAINNET_ID })}
              className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Switch to Arc Mainnet
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-muted)] flex items-center justify-center">
              <Zap size={28} className="text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--ink)] display tracking-tight mb-2">AgentTab</h1>
              <p className="text-[var(--muted)] text-sm max-w-xs text-pretty">
                Prepaid USDC tabs for AI agents and services. Providers list services; clients deposit and consume.
              </p>
            </div>
            <ConnectKitButton label="Connect wallet to start" />
          </div>
        ) : isWrongNetwork ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
            <AlertTriangle size={36} className="text-red-400" />
            <p className="text-[var(--muted)] text-sm max-w-xs">
              Switch to Arc Mainnet to use AgentTab.
            </p>
            <button
              onClick={() => switchChain({ chainId: ARC_MAINNET_ID })}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Switch to Arc Mainnet
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'client' && <ClientPage />}
            {activeTab === 'provider' && <ProviderPage />}
          </>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root router: / → LandingPage, /#/app → AppShell, /#/deploy → redirect to /#/app
// ---------------------------------------------------------------------------

export default function App() {
  const hash = useHash()

  // Redirect any /#/deploy URL to /#/app
  useEffect(() => {
    if (hash.startsWith('#/deploy')) {
      window.location.hash = '/app'
    }
  }, [hash])

  const isApp = hash.startsWith('#/app') || hash.startsWith('#/deploy')
  return isApp ? <AppShell /> : <LandingPage />
}
