/**
 * Reusable transaction button that shows wallet/confirming/success/error states.
 */
import { useAccount, useSwitchChain } from 'wagmi'
import { ARC_MAINNET_ID } from '../utils'

interface TxButtonProps {
  onClick: () => void
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  label: string
  pendingLabel?: string
  confirmingLabel?: string
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
}

export function TxButton({
  onClick,
  isPending,
  isConfirming,
  isSuccess,
  label,
  pendingLabel = 'Confirm in wallet…',
  confirmingLabel = 'Confirming…',
  disabled = false,
  variant = 'primary',
  className = '',
}: TxButtonProps) {
  const { chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongChain = chainId !== undefined && chainId !== ARC_MAINNET_ID

  if (isWrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: ARC_MAINNET_ID })}
        disabled={isSwitching}
        className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {isSwitching ? 'Switching…' : 'Switch to Arc Mainnet'}
      </button>
    )
  }

  const isLoading = isPending || isConfirming
  const base =
    'w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]'
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
    ghost: 'bg-transparent border border-[var(--border-strong)] text-[var(--ink-2)] hover:bg-[var(--surface-muted)]',
    danger: 'bg-[var(--danger)] text-white hover:opacity-90',
  }

  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {isPending ? pendingLabel : isConfirming ? confirmingLabel : isSuccess ? 'Done' : label}
    </button>
  )
}
