/**
 * useAuthGate — gate write/DB operations behind sign-in.
 *
 * Reads are open (anonymous can browse), but every mutation (add, edit,
 * delete, toggle…) must go through `guard`. When signed out, `guard` opens
 * the sign-in overlay and skips the action; when signed in it runs it.
 *
 *   const { guard, authModal, isSignedIn } = useAuthGate()
 *   <button onClick={() => guard(() => remove(id))}>Delete</button>
 *   {authModal}
 */

import { useCallback, useState } from 'react'
import { useAuth, AuthOverlay } from 'deepspace'

export function useAuthGate() {
  const { isSignedIn } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  /** Run `action` only when signed in; otherwise prompt sign-in. Returns whether it ran. */
  const guard = useCallback(
    (action?: () => void | Promise<void>): boolean => {
      if (!isSignedIn) {
        setShowAuth(true)
        return false
      }
      void action?.()
      return true
    },
    [isSignedIn],
  )

  const authModal = showAuth ? <AuthOverlay onClose={() => setShowAuth(false)} /> : null

  return { isSignedIn, guard, authModal, promptSignIn: () => setShowAuth(true) }
}
