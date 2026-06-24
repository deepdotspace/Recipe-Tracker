/**
 * useConfirm — replace native `window.confirm` with a themed modal.
 *
 * Mirrors `useAuthGate`'s ergonomics: call `confirm(opts, onConfirm)` to open
 * the dialog, and render `{confirmModal}` once in the view.
 *
 *   const { confirm, confirmModal } = useConfirm()
 *   <button onClick={() => confirm(
 *     { title: 'Delete recipe?', confirmText: 'Delete' },
 *     () => remove(id),
 *   )}>Delete</button>
 *   {confirmModal}
 */

import { useCallback, useState } from 'react'
import { ConfirmModal } from '../components/ui'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
}

type PendingConfirm = ConfirmOptions & { onConfirm: () => void | Promise<void> }

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions, onConfirm: () => void | Promise<void>) => {
      setPending({ ...opts, onConfirm })
    },
    [],
  )

  const confirmModal = (
    <ConfirmModal
      open={pending !== null}
      onClose={() => setPending(null)}
      onConfirm={() => {
        void pending?.onConfirm()
        setPending(null)
      }}
      title={pending?.title ?? ''}
      description={pending?.description}
      confirmText={pending?.confirmText}
      cancelText={pending?.cancelText}
      variant={pending?.variant ?? 'destructive'}
    />
  )

  return { confirm, confirmModal }
}
