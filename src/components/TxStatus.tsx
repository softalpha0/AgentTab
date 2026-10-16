/**
 * Inline transaction status strip shown below a form.
 */
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_MAINNET_ID } from '../utils'

interface TxStatusProps {
  isSuccess: boolean
  isError: boolean
  error: Error | null
  hash?: string
  successMessage?: string
}

export function TxStatus({ isSuccess, isError, error, hash, successMessage = 'Transaction confirmed.' }: TxStatusProps) {
  if (!isSuccess && !isError) return null

  if (isSuccess) {
    const explorerUrl = hash ? buildTxExplorerUrl(ARC_MAINNET_ID, hash) : undefined
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#e8f7ef] text-[var(--success)] text-sm">
        <CheckCircle size={16} className="mt-0.5 shrink-0" />
        <span className="flex-1">{successMessage}</span>
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:opacity-70">
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    )
  }

  if (isError) {
    const msg = (error as { message?: string })?.message ?? 'Transaction failed.'
    const userFriendly =
      msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('denied')
        ? 'Transaction cancelled.'
        : msg.toLowerCase().includes('insufficienttabbalance')
        ? 'Tab balance too low.'
        : msg.toLowerCase().includes('notserviceprovider')
        ? 'Only the service provider can claim.'
        : msg.toLowerCase().includes('nottabclient')
        ? 'Only the tab owner can do this.'
        : msg.toLowerCase().includes('tabalreadyclosed')
        ? 'Tab is already closed.'
        : msg.toLowerCase().includes('insufficient')
        ? 'Insufficient USDC. Approve the contract first.'
        : 'Transaction failed. Please try again.'

    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#fde8ec] text-[var(--danger)] text-sm">
        <XCircle size={16} className="mt-0.5 shrink-0" />
        <span>{userFriendly}</span>
      </div>
    )
  }

  return null
}
