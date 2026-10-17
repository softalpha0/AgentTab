import { useEffect, useState } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB = 'https://github.com/softalpha0/AgentTab'
const EXPLORER = 'https://explorer.arc.io/address/0x77c91303cda1a54219cdec6aa55d4691dde09aea'
const CONTRACT = '0x77c91303cda1a54219cdec6aa55d4691dde09aea' as const
const USDC = '0x3600000000000000000000000000000000000000' as const

const arcMainnet = {
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
} as const

const CURRENT_YEAR = new Date().getFullYear()

const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http('https://rpc.mainnet.arc.io'),
})

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function IconZap({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function IconArrow({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function IconGitHub({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.021C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function IconShield({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconCode({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function IconClock({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconWallet({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H8L4 7h16l-4-4z" />
      <circle cx="17" cy="13" r="1" fill="currentColor" />
    </svg>
  )
}

function IconPen({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconCoins({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Live stats
// ---------------------------------------------------------------------------

interface Stats {
  services: string
  tabs: string
  tvl: string
}

function useStats(): { stats: Stats | null; error: boolean } {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [services, tabs, balance] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT,
            abi: [{ name: 'serviceCount', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'serviceCount',
          }),
          publicClient.readContract({
            address: CONTRACT,
            abi: [{ name: 'tabCount', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'tabCount',
          }),
          publicClient.readContract({
            address: USDC,
            abi: [{ name: 'balanceOf', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'balanceOf',
            args: [CONTRACT],
          }),
        ])
        if (!cancelled) {
          setStats({
            services: services.toString(),
            tabs: tabs.toString(),
            tvl: Number(formatUnits(balance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          })
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return { stats, error }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors">
      {children}
    </a>
  )
}

function LaunchButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size]
  return (
    <a
      href="/#/app"
      className={`inline-flex items-center gap-2 ${cls} bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl transition-colors`}
    >
      Launch App <IconArrow size={14} />
    </a>
  )
}

function StatCard({ label, value, loading, error }: { label: string; value?: string; loading: boolean; error: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-1 py-6">
      {loading ? (
        <div className="h-8 w-16 rounded-lg bg-[var(--surface-muted)] animate-pulse" />
      ) : error ? (
        <span className="text-2xl font-bold text-[var(--muted)]">—</span>
      ) : (
        <span className="text-3xl font-bold display text-[var(--ink)] tracking-tight">{value}</span>
      )}
      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{label}</span>
    </div>
  )
}

const HOW_IT_WORKS = [
  {
    icon: <IconWallet size={22} />,
    title: 'Open a tab',
    body: 'Deposit USDC into a service tab. Funds are held in the contract until claimed or refunded.',
  },
  {
    icon: <IconPen size={22} />,
    title: 'Sign a receipt per call',
    body: 'After each API call, sign a free EIP-712 receipt with your wallet. No on-chain transaction required.',
  },
  {
    icon: <IconCoins size={22} />,
    title: 'Provider claims',
    body: 'Providers submit your signed receipt on-chain. Only the calls you signed are paid — replay-proof.',
  },
  {
    icon: <IconClock size={22} />,
    title: 'Close safely',
    body: 'Request a close, wait 1 hour (providers can still claim), then withdraw your unspent USDC.',
  },
]

const FEATURES = [
  { icon: <IconShield size={18} />, title: 'Replay-proof receipts', body: 'Monotonic totalCalls high-water mark stored on-chain. Stale or duplicate receipts revert.' },
  { icon: <IconCode size={18} />, title: 'AI agent native', body: 'ERC-1271 support via SignatureChecker — works with smart-contract agent wallets, not just EOAs.' },
  { icon: <IconClock size={18} />, title: 'Safe two-step close', body: '1-hour close window lets providers make a final claim before any refund is released.' },
  { icon: <IconZap size={18} />, title: 'Security-reviewed', body: 'Automated security and functional reviews in Arc Studio, Slither static analysis, and 18 passing Foundry tests. Not a third-party audit.' },
  { icon: <IconCoins size={18} />, title: 'USDC on Arc', body: 'USDC is the native gas token on Arc. Stable, fast, and predictable transaction fees.' },
]

const SDK_SNIPPET = `import { AgentTabClient } from './sdk/agenttab'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY)
const agent = new AgentTabClient(account)

// After each API call, sign a fresh receipt
const receipt = await agent.recordCall(tabId)
// receipt.signature → give this to the provider to claim`

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const { stats, error } = useStats()
  const loading = !stats && !error

  return (
    <div className="min-h-dvh bg-[var(--bg)] bg-[image:var(--bg-gradient)] text-[var(--ink)]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <IconZap size={15} className="text-white" />
            </div>
            <span className="font-bold text-[var(--ink)] display text-lg tracking-tight">AgentTab</span>
          </a>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-6">
            <NavLink href="#how-it-works">How it works</NavLink>
            <NavLink href="#features">Features</NavLink>
            <NavLink href={`${GITHUB}#readme`}>Docs</NavLink>
            <NavLink href={GITHUB}>GitHub</NavLink>
          </nav>

          <LaunchButton size="sm" />
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        {/* Mainnet badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live on Arc Mainnet
        </div>

        <h1 className="display font-bold tracking-tight text-4xl sm:text-5xl md:text-6xl text-[var(--ink)] mb-6 text-balance leading-tight">
          Pay-per-call billing<br className="hidden sm:block" /> for APIs and AI agents
        </h1>
        <p className="text-lg sm:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-10 text-pretty">
          Prepay USDC into a tab. Sign a free receipt for every call. Providers only get paid for what you signed, on Arc.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <LaunchButton size="lg" />
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-base bg-[var(--surface-muted)] hover:bg-[var(--border)] text-[var(--ink)] font-semibold rounded-xl transition-colors border border-[var(--border)]"
          >
            <IconGitHub size={18} /> View on GitHub
          </a>
        </div>
      </section>

      {/* ── Live stats ──────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Services" value={stats?.services} loading={loading} error={error} />
          <StatCard label="Tabs opened" value={stats?.tabs} loading={loading} error={error} />
          <StatCard label="USDC held" value={stats ? `$${stats.tvl}` : undefined} loading={loading} error={error} />
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="display font-bold text-2xl sm:text-3xl text-center text-[var(--ink)] tracking-tight mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--accent)] shrink-0">
                  {step.icon}
                </div>
                <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Step {i + 1}</span>
              </div>
              <h3 className="font-bold text-[var(--ink)] text-base">{step.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="bg-[var(--surface-muted)] py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="display font-bold text-2xl sm:text-3xl text-center text-[var(--ink)] tracking-tight mb-12">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="card flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  {f.icon}
                  <span className="font-bold text-[var(--ink)] text-sm">{f.title}</span>
                </div>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent SDK ───────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-center gap-2 mb-4">
          <IconCode size={20} className="text-[var(--accent)]" />
          <h2 className="display font-bold text-2xl text-[var(--ink)] tracking-tight">Agent SDK</h2>
        </div>
        <p className="text-[var(--muted)] text-sm mb-6">
          A small TypeScript library (built on viem) lets AI agents sign and verify receipts with a single method call. Accepts a <code className="mono bg-[var(--surface-muted)] px-1.5 py-0.5 rounded text-xs">LocalAccount</code> (private key) for server use, or a <code className="mono bg-[var(--surface-muted)] px-1.5 py-0.5 rounded text-xs">WalletClient</code> for browser dapps.
        </p>
        <pre className="mono text-xs sm:text-sm bg-[var(--ink)] text-emerald-300 rounded-2xl p-5 overflow-x-auto leading-relaxed whitespace-pre">{SDK_SNIPPET}</pre>
        <div className="mt-4 flex gap-3">
          <a href={`${GITHUB}/tree/main/sdk`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline">
            <IconGitHub size={14} /> Browse sdk/ on GitHub
          </a>
          <span className="text-[var(--border-strong)]">·</span>
          <a href={`${GITHUB}#agent-sdk`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline">
            README docs
          </a>
        </div>
      </section>

      {/* ── Proof on chain ──────────────────────────────────────────────────── */}
      <section className="bg-[var(--surface-muted)] py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="display font-bold text-xl sm:text-2xl text-[var(--ink)] tracking-tight mb-8">Proof on chain</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="card inline-flex items-center gap-3 hover:border-[var(--accent)] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
                <IconZap size={14} className="text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--ink)]">AgentTabV2 contract</div>
                <div className="mono text-xs text-[var(--muted)]">0x77c9…9aea</div>
              </div>
              <IconArrow size={14} className="text-[var(--muted)]" />
            </a>
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="card inline-flex items-center gap-3 hover:border-[var(--accent)] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--ink)] flex items-center justify-center shrink-0">
                <IconGitHub size={16} className="text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--ink)]">softalpha0/AgentTab</div>
                <div className="text-xs text-[var(--muted)]">Source, tests, SDK</div>
              </div>
              <IconArrow size={14} className="text-[var(--muted)]" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-[var(--accent)] flex items-center justify-center">
              <IconZap size={10} className="text-white" />
            </div>
            <span className="font-semibold text-[var(--ink-2)]">AgentTab</span>
            <span>— Built with Arc Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={GITHUB} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[var(--ink)] transition-colors">
              <IconGitHub size={14} /> GitHub
            </a>
            <a href={EXPLORER} target="_blank" rel="noopener noreferrer"
              className="hover:text-[var(--ink)] transition-colors">
              Explorer
            </a>
            <span>© {CURRENT_YEAR} AgentTab</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
