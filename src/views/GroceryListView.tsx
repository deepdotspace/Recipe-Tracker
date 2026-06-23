/**
 * Grocery List Page - Manage shopping list from recipe ingredients
 */

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutations, useRecordContext } from 'deepspace'
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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/80 p-6 shadow-card backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Grocery List</h1>
              <p className="text-sm text-muted-foreground">
                {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get
                {checkedCount > 0 && ` · ${checkedCount} in the cart`}
              </p>
            </div>
          </div>
          {total > 0 && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1.5">
                {checkedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearChecked}>Clear checked</Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-danger hover:text-danger">Clear all</Button>
              </div>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="relative mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs text-muted-foreground">{progress}% gathered</p>
          </div>
        )}

        {/* Add item */}
        <div className="relative mt-5 flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
            placeholder="Add an item — e.g. ripe avocados"
            className="flex-1 rounded-full border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button onClick={addManualItem} disabled={!newItem.trim()} className="rounded-full px-5">Add</Button>
        </div>
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="mb-1.5 text-lg font-semibold text-foreground">Your cart is empty</h3>
          <p className="mx-auto mb-5 max-w-xs text-sm text-muted-foreground">
            Add items above, or pull ingredients straight from a saved recipe.
          </p>
          <Link to="/recipes">
            <Button variant="secondary" className="rounded-full">Browse recipes</Button>
          </Link>
        </div>
      )}

      {/* Grouped list */}
      <div className="mt-6 space-y-5">
        {Object.entries(groupedByRecipe).map(([recipeName, recipeItems]) => {
          const remaining = recipeItems.filter((i) => !isGroceryChecked(i.data.checked)).length
          return (
            <div key={recipeName}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                  {recipeName === 'Manual' ? 'Added by you' : recipeName}
                </h2>
                <span className="text-xs text-muted-foreground">· {remaining} left</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-card backdrop-blur-sm">
                {recipeItems.map((item, idx) => {
                  const done = isGroceryChecked(item.data.checked)
                  return (
                    <div
                      key={item.recordId}
                      className={`group flex items-center gap-3 px-4 py-3 transition-colors ${idx > 0 ? 'border-t border-border' : ''} ${done ? 'bg-secondary/40' : 'hover:bg-secondary/30'}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleChecked(item)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${done ? 'border-success bg-success text-white' : 'border-border hover:border-primary'}`}
                      >
                        {done && (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <span className={`flex-1 text-sm ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {item.data.ingredient}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeItem(item.recordId)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                        aria-label="Remove item"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
