/**
 * usePlanGate — resolve the signed-in user's effective plan limits and
 * current usage, plus an upgrade-prompt modal for when a gate trips.
 *
 *   const gate = usePlanGate()
 *   if (!gate.canExtract) { gate.promptUpgrade('extractions'); return }
 *   ...
 *   {gate.upgradeModal}
 *
 * All gating here is UI-level: it keeps honest users inside their plan and
 * bots behind the sign-in wall (integration calls are owner-billed). Numbers
 * live in src/plan-limits.ts.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Button, Modal } from '../components/ui'
import { useSubscriptionSafe } from './subscription-context'
import {
  PLAN_LIMITS,
  effectiveTier,
  currentMonthStart,
  type PlanLimits,
} from '../plan-limits'
import type { SubscriptionPlanSlug } from '../subscriptions'

export type UpgradeReason = 'extractions' | 'saves' | 'youtube'

const REASON_COPY: Record<UpgradeReason, { title: string; body: string }> = {
  extractions: {
    title: 'Monthly extraction limit reached',
    body: 'You’ve used all the link extractions in your current plan this month. Upgrade to keep clipping recipes, or come back next month.',
  },
  saves: {
    title: 'Recipe box is full',
    body: 'Your current plan’s saved-recipe limit is reached. Upgrade for a bigger box, or delete a few recipes to make room.',
  },
  youtube: {
    title: 'YouTube extraction is a paid feature',
    body: 'Reading a recipe out of a video transcript is available on Plus and up. Upgrade to clip recipes straight from YouTube.',
  },
}

interface ExtractionLogRecord {
  recordId: string
  data: { at?: string }
}

interface RecipeCountRecord {
  recordId: string
}

export function usePlanGate() {
  const sub = useSubscriptionSafe()
  const navigate = useNavigate()
  const [reason, setReason] = useState<UpgradeReason | null>(null)

  const { records: extractionLog } = useQuery('extractionLog') as { records: ExtractionLogRecord[] }
  const { records: recipes } = useQuery('recipes') as { records: RecipeCountRecord[] }

  const tier: SubscriptionPlanSlug = effectiveTier(sub)
  const limits: PlanLimits = PLAN_LIMITS[tier]

  const extractionsThisMonth = useMemo(() => {
    const monthStart = currentMonthStart()
    return (extractionLog ?? []).filter((r) => (r.data.at ?? '') >= monthStart).length
  }, [extractionLog])

  const savedCount = recipes?.length ?? 0

  const canExtract = extractionsThisMonth < limits.extractionsPerMonth
  const canSave = limits.savedRecipes === null || savedCount < limits.savedRecipes
  const canUseYouTube = limits.youtube

  const copy = reason ? REASON_COPY[reason] : null
  const upgradeModal = (
    <Modal open={reason !== null} onClose={() => setReason(null)} size="sm">
      {copy && (
        <>
          <Modal.Header>
            <Modal.Title>{copy.title}</Modal.Title>
            <Modal.Description>{copy.body}</Modal.Description>
          </Modal.Header>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setReason(null)}>
              Not now
            </Button>
            <Button onClick={() => { setReason(null); navigate('/pricing') }}>
              See plans
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  )

  return {
    tier,
    limits,
    extractionsThisMonth,
    savedCount,
    canExtract,
    canSave,
    canUseYouTube,
    subscriptionLoading: sub.isLoading,
    promptUpgrade: (r: UpgradeReason) => setReason(r),
    upgradeModal,
  }
}
