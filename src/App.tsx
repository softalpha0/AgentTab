import { useState, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Zap, CreditCard, Rocket } from 'lucide-react'
import ProviderPage from './pages/ProviderPage'
import ClientPage from './pages/ClientPage'
import DeployPage from './pages/DeployPage'

type Tab = 'client' | 'provider' | 'deploy'

/** Minimal hash-based router — returns the path fragment after the '#'. */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace('#', '') || '/')
  useEffect(() => {
    function onHash() { setHash(window.location.hash.replace('#', '') || '/') }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash
}

export default function App() {
  const route = useHashRoute()
  const { isConnected } = useAccount()

  // /#/deploy hash route also opens the Deploy tab directly
  const [tab, setTabState] = useState<Tab>(() =>
    route === '/deploy' ? 'deploy' : 'client'
  )

  function setTab(t: Tab) {
    setTabState(t)
    window.location.hash = t === 'deploy' ? '/deploy' : '/'
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] bg-[image:var(--bg-gradient)]">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-[var(--ink)] tracking-tight display text-base">AgentTab</span>
          </div>
          <ConnectKitButton />
        </div>

        {/* Role tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1 p-1 bg-[var(--surface-muted)] rounded-xl">
            <button
              onClick={() => setTab('client')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'client'
                  ? 'bg-white shadow-sm text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
              }`}
            >
              <CreditCard size={14} />
              Client
            </button>
            <button
              onClick={() => setTab('provider')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'provider'
                  ? 'bg-white shadow-sm text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
              }`}
            >
              <Zap size={14} />
              Provider
            </button>
            <button
              onClick={() => setTab('deploy')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'deploy'
                  ? 'bg-white shadow-sm text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
              }`}
            >
              <Rocket size={14} />
              Deploy
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {tab === 'deploy' ? (
          <DeployPage />
        ) : !isConnected ? (
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
        ) : (
          <>
            {tab === 'client' && <ClientPage />}
            {tab === 'provider' && <ProviderPage />}
          </>
        )}
      </main>
    </div>
  )
}
