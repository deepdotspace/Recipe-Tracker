/**
 * Grocery List Page - Manage shopping list from recipe ingredients
 */

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutations, useRecordContext } from 'deepspace'
import { Check, X, Plus, ClipboardCheck } from 'lucide-react'
import { Button, useToast } from '../components/ui'
import { isGroceryChecked } from '../utils/groceryChecked'
import { useAuthGate } from '../hooks/useAuthGate'

interface GroceryItem {
  ingredient: string
  recipeId: string
  recipeTitle: string
  checked?: boolean | number | string
  addedAt: string
}

interface GroceryRecord {
  recordId: string
  data: GroceryItem
}

export default function GroceryListPage() {
  const { records: items } = useQuery('groceryList') as { records: GroceryRecord[] }
  const { putConfirmed, removeConfirmed, createConfirmed } = useMutations('groceryList')
  const { ready: recordStoreReady } = useRecordContext()
  const { error: toastError } = useToast()
  const { guard, authModal } = useAuthGate()

  const [newItem, setNewItem] = useState('')

  // Sort: unchecked first, then by date added
  const sortedItems = [...(items || [])].sort((a, b) => {
    const ac = isGroceryChecked(a.data.checked)
    const bc = isGroceryChecked(b.data.checked)
    if (ac !== bc) return ac ? 1 : -1
    return new Date(b.data.addedAt).getTime() - new Date(a.data.addedAt).getTime()
  })

  // Group by recipe
  const groupedByRecipe = sortedItems.reduce((acc, item) => {
    const key = item.data.recipeTitle || 'Manual'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, GroceryRecord[]>)

  const toggleChecked = useCallback((record: GroceryRecord) => guard(async () => {
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    try {
      await putConfirmed(record.recordId, {
        ...record.data,
        checked: !isGroceryChecked(record.data.checked),
      })
    } catch (e) {
      toastError('Failed to check off item', e instanceof Error ? e.message : 'Could not update item')
    }
  }), [guard, putConfirmed, recordStoreReady, toastError])

  const removeItem = useCallback((recordId: string) => guard(async () => {
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    try {
      await removeConfirmed(recordId)
    } catch (e) {
      toastError('Failed to remove item', e instanceof Error ? e.message : 'Could not remove item')
    }
  }), [guard, removeConfirmed, recordStoreReady, toastError])

  const addManualItem = useCallback(() => guard(async () => {
    if (!newItem.trim()) return
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    try {
      await createConfirmed({
        ingredient: newItem.trim(),
        recipeId: '',
        recipeTitle: '',
        checked: false,
        addedAt: new Date().toISOString(),
      })
      setNewItem('')
    } catch (e) {
      toastError('Failed to add item', e instanceof Error ? e.message : 'Could not add item')
    }
  }), [guard, newItem, createConfirmed, recordStoreReady, toastError])

  const clearChecked = useCallback(() => guard(async () => {
    const checkedItems = items?.filter((i) => isGroceryChecked(i.data.checked)) || []
    try {
      for (const item of checkedItems) await removeConfirmed(item.recordId)
    } catch (e) {
      toastError('Failed to clear checked items', e instanceof Error ? e.message : 'Could not clear items')
    }
  }), [guard, items, removeConfirmed, toastError])

  const clearAll = useCallback(() => guard(async () => {
    try {
      for (const item of items || []) await removeConfirmed(item.recordId)
    } catch (e) {
      toastError('Failed to clear list', e instanceof Error ? e.message : 'Could not clear list')
    }
  }), [guard, items, removeConfirmed, toastError])

  const uncheckedCount = items?.filter((i) => !isGroceryChecked(i.data.checked)).length || 0
  const checkedCount = items?.filter((i) => isGroceryChecked(i.data.checked)).length || 0
  const total = uncheckedCount + checkedCount
  const progress = total > 0 ? Math.round((checkedCount / total) * 100) : 0

  return (
    <div className="mx-auto max-w-[680px] px-7 pb-[72px] pt-10">
      {/* Header */}
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-deep">
          Ready to shop
        </p>
        <h1 className="mt-2 text-[36px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          Grocery list
        </h1>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-[14.5px] text-muted-foreground">
            {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get · {checkedCount} already in the cart
          </p>
          {total > 0 && (
            <div className="flex items-center gap-1">
              {checkedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearChecked}>Clear checked</Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">Clear all</Button>
            </div>
          )}
        </div>
      </header>

      {/* Progress card */}
      <div className="rounded-[20px] border border-border bg-card p-5 shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-secondary-foreground">{progress}% gathered</span>
          <span className="text-[13px] text-muted-2">{checkedCount} of {total}</span>
        </div>
        <div className="mt-3 h-[9px] w-full overflow-hidden rounded-full bg-photo-tile">
          <div
            className="h-full rounded-full bg-success transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Add item */}
        <div className="mt-5 flex gap-2.5">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
            placeholder="Add an item — e.g. ripe avocados"
            className="h-[46px] flex-1 rounded-[13px] border border-input bg-surface-soft px-4 text-[14.5px] text-body placeholder:text-faint transition-colors duration-150 focus:border-primary focus:outline-none"
          />
          <Button
            onClick={addManualItem}
            disabled={!newItem.trim()}
            className="h-[46px] rounded-[13px] px-5 shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)]"
          >
            <Plus />
            Add
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="mt-6 rounded-[20px] border border-dashed border-border bg-surface-soft p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-note text-primary-deep">
            <ClipboardCheck className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <h3 className="mb-1.5 text-lg font-semibold text-ink">Your cart is empty</h3>
          <p className="mx-auto mb-5 max-w-xs text-sm text-body-soft">
            Add items above, or pull ingredients straight from a saved recipe.
          </p>
          <Link to="/recipes">
            <Button variant="secondary" className="rounded-[13px]">Browse recipes</Button>
          </Link>
        </div>
      )}

      {/* Grouped list */}
      <div className="mt-8 space-y-6">
        {Object.entries(groupedByRecipe).map(([recipeName, recipeItems]) => {
          const remaining = recipeItems.filter((i) => !isGroceryChecked(i.data.checked)).length
          return (
            <div key={recipeName}>
              <div className="mb-2.5 flex items-center gap-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-primary-deep">
                  {recipeName === 'Manual' ? 'Added by you' : recipeName}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[12.5px] text-muted-2">{remaining} left</span>
              </div>

              <div className="overflow-hidden rounded-[16px] border border-border bg-card">
                {recipeItems.map((item, idx) => {
                  const done = isGroceryChecked(item.data.checked)
                  return (
                    <div
                      key={item.recordId}
                      className={`group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ${idx > 0 ? 'border-t border-[#f4ece0]' : ''} ${done ? 'bg-[#fbf4e9]' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleChecked(item)}
                        aria-label={done ? 'Uncheck item' : 'Check off item'}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${done ? 'border-success bg-success text-white' : 'border-[#dcc9b0] bg-transparent'}`}
                      >
                        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>

                      <span className={`flex-1 text-[14.5px] ${done ? 'text-muted-2 line-through' : 'text-body'}`}>
                        {item.data.ingredient}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItem(item.recordId)}
                        className="shrink-0 text-faint opacity-0 transition-all duration-150 hover:text-destructive group-hover:opacity-100"
                        aria-label="Remove item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {authModal}
    </div>
  )
}
