/**
 * Discover Page — curated gallery of popular recipes.
 *
 * Anyone can browse; saving copies the recipe into the signed-in user's
 * `recipes` collection (same shape as an extracted recipe), gated by
 * useAuthGate. Data lives in src/data/popular-recipes.ts.
 */

import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutations, useRecordContext } from 'deepspace'
import { Clock, Flame, Dumbbell, Users, Check, Plus, ArrowRight } from 'lucide-react'
import { Button, Modal, useToast } from '../components/ui'
import { MEAL_ACCENT } from '../constants'
import { useAuthGate } from '../hooks/useAuthGate'
import { usePlanGate } from '../hooks/usePlanGate'
import {
  CATEGORIES,
  POPULAR_RECIPES,
  toRecipeData,
  type CategoryId,
  type PopularRecipe,
} from '../data/popular-recipes'

interface RecipeRecord {
  recordId: string
  data: { title: string }
}

type Filter = CategoryId | 'all'

export default function DiscoverPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<PopularRecipe | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const { records: myRecipes } = useQuery('recipes') as { records: RecipeRecord[] }
  const { createConfirmed } = useMutations('recipes')
  const { ready: recordStoreReady } = useRecordContext()
  const { guard, authModal } = useAuthGate()
  const planGate = usePlanGate()
  const { success: toastSuccess, error: toastError } = useToast()

  const savedTitles = useMemo(
    () => new Set((myRecipes ?? []).map((r) => r.data.title.toLowerCase())),
    [myRecipes],
  )

  const visible = useMemo(
    () =>
      filter === 'all'
        ? POPULAR_RECIPES
        : POPULAR_RECIPES.filter((r) => r.categories.includes(filter)),
    [filter],
  )

  const activeCategory = filter === 'all' ? null : CATEGORIES.find((c) => c.id === filter)

  const saveRecipe = useCallback(
    (recipe: PopularRecipe) => {
      const ran = guard(async () => {
        if (!recordStoreReady) {
          toastError('Not connected', 'Wait for the app to finish loading, then try again.')
          return
        }
        if (!planGate.canSave) {
          setSelected(null)
          planGate.promptUpgrade('saves')
          return
        }
        setSavingId(recipe.id)
        try {
          await createConfirmed(toRecipeData(recipe))
          toastSuccess('Recipe saved', `"${recipe.title}" is now in My Recipes.`)
          setSelected(null)
        } catch (e) {
          toastError('Failed to save', e instanceof Error ? e.message : 'Please try again.')
        } finally {
          setSavingId(null)
        }
      })
      // Signed out: guard opened the sign-in overlay — close the recipe
      // dialog so the overlay isn't hidden behind it.
      if (!ran) setSelected(null)
    },
    [guard, recordStoreReady, planGate, createConfirmed, toastSuccess, toastError],
  )

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1160px] px-7 py-10">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary-deep">
            From the Community
          </span>
          <h1 className="text-[36px] font-extrabold tracking-[-0.03em] text-ink max-sm:text-3xl">
            Discover recipes
          </h1>
          <p className="max-w-xl text-[14.5px] text-muted-foreground">
            Popular, tested recipes ready to cook — save one to your collection with a single
            click, then build your grocery list from it.
          </p>
        </div>

        {/* Category chips */}
        <div className="mt-7 flex flex-wrap gap-2.5">
          <CategoryChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.label}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
            />
          ))}
        </div>
        {activeCategory && (
          <p className="mt-3 text-[13px] text-muted-2">{activeCategory.blurb}</p>
        )}

        {/* Gallery grid */}
        <div className="mt-7 grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((recipe) => {
            const saved = savedTitles.has(recipe.title.toLowerCase())
            return (
              <div
                key={recipe.id}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)] transition-transform duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]"
              >
                <button
                  onClick={() => setSelected(recipe)}
                  className="relative block h-[168px] overflow-hidden bg-photo-tile text-left"
                  aria-label={`View ${recipe.title}`}
                >
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span
                    className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[12px] font-semibold capitalize shadow-[0_2px_8px_rgba(61,35,20,0.15)]"
                    style={{ color: MEAL_ACCENT[recipe.mealType] }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: MEAL_ACCENT[recipe.mealType] }}
                    />
                    {recipe.mealType}
                  </span>
                </button>

                <div className="flex flex-1 flex-col p-4">
                  <button onClick={() => setSelected(recipe)} className="text-left">
                    <h3 className="text-[17px] font-bold leading-[1.25] tracking-[-0.015em] text-ink">
                      {recipe.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] text-muted-2">
                      {recipe.description}
                    </p>
                  </button>

                  <div className="mt-3 flex items-center gap-4 text-[13px] text-muted-2">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {recipe.minutes} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5" /> {recipe.calories} kcal
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="h-3.5 w-3.5" /> {recipe.protein}g protein
                    </span>
                  </div>

                  {recipe.categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {recipe.categories.map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-tag px-2.5 py-0.5 text-[11.5px] font-semibold text-[#8a6a4a]"
                        >
                          {CATEGORIES.find((c) => c.id === id)?.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                    {saved ? (
                      <Link
                        to="/recipes"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-success bg-surface-soft px-3 py-2.5 text-[13px] font-semibold text-success transition-colors hover:bg-tag"
                      >
                        <Check className="h-4 w-4" /> Saved — view in My Recipes
                      </Link>
                    ) : (
                      <button
                        onClick={() => saveRecipe(recipe)}
                        disabled={savingId === recipe.id}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-3 py-2.5 text-[13px] font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep disabled:opacity-60"
                      >
                        {savingId === recipe.id ? (
                          'Saving…'
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> Save to My Recipes
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setSelected(recipe)}
                      className="rounded-[12px] px-3 py-2.5 text-[13px] font-semibold text-body-soft transition-colors duration-150 hover:text-ink"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail modal */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <>
            <Modal.Header>
              <Modal.Title>{selected.title}</Modal.Title>
              <Modal.Description>{selected.description}</Modal.Description>
            </Modal.Header>
            <Modal.Body>
              <img
                src={selected.imageUrl}
                alt={selected.title}
                className="h-52 w-full rounded-xl object-cover"
              />
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-content-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {selected.minutes} min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="h-4 w-4" /> ≈{selected.calories} kcal / serving
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Dumbbell className="h-4 w-4" /> {selected.protein}g protein
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Serves {selected.servings}
                </span>
              </div>

              <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_1.4fr]">
                <div>
                  <h4 className="text-sm font-semibold text-content">
                    Ingredients ({selected.ingredients.length})
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-content-secondary">
                    {selected.ingredients.map((ing, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-content">Instructions</h4>
                  <ol className="mt-2 space-y-2.5 text-sm text-content-secondary">
                    {selected.instructions.map((step, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cream text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
              {savedTitles.has(selected.title.toLowerCase()) ? (
                <Link
                  to="/recipes"
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-success bg-surface-soft px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-tag"
                >
                  <Check className="h-4 w-4" /> In My Recipes <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Button onClick={() => saveRecipe(selected)} disabled={savingId === selected.id}>
                  {savingId === selected.id ? 'Saving…' : 'Save to My Recipes'}
                </Button>
              )}
            </Modal.Footer>
          </>
        )}
      </Modal>

      {authModal}
      {planGate.upgradeModal}
    </div>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[46px] items-center rounded-[14px] px-4 text-[13.5px] font-semibold transition-colors duration-150 ${
        active
          ? 'bg-ink text-[#fdf6ec]'
          : 'border border-input bg-surface-soft text-[#8a6a4a] hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}
