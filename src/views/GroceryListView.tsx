/**
 * Grocery List Page - Manage shopping list from recipe ingredients
 */

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutations, useRecordContext } from 'deepspace'
import { Button, useToast } from '../components/ui'
import { isGroceryChecked } from '../utils/groceryChecked'

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
  
  const toggleChecked = useCallback(async (record: GroceryRecord) => {
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
      const message = e instanceof Error ? e.message : 'Could not update item'
      toastError('Failed to check off item', message)
    }
  }, [putConfirmed, recordStoreReady, toastError])

  const removeItem = useCallback(async (recordId: string) => {
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    try {
      await removeConfirmed(recordId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not remove item'
      toastError('Failed to remove item', message)
    }
  }, [removeConfirmed, recordStoreReady, toastError])
  
  const addManualItem = useCallback(async () => {
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
      const message = e instanceof Error ? e.message : 'Could not add item'
      toastError('Failed to add item', message)
    }
  }, [newItem, createConfirmed, recordStoreReady, toastError])
  
  const clearChecked = useCallback(async () => {
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    const checkedItems = items?.filter((i) => isGroceryChecked(i.data.checked)) || []
    try {
      for (const item of checkedItems) {
        await removeConfirmed(item.recordId)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not clear items'
      toastError('Failed to clear checked items', message)
    }
  }, [items, removeConfirmed, recordStoreReady, toastError])

  const clearAll = useCallback(async () => {
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    try {
      for (const item of items || []) {
        await removeConfirmed(item.recordId)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not clear list'
      toastError('Failed to clear list', message)
    }
  }, [items, removeConfirmed, recordStoreReady, toastError])
  
  const uncheckedCount = items?.filter((i) => !isGroceryChecked(i.data.checked)).length || 0
  const checkedCount = items?.filter((i) => isGroceryChecked(i.data.checked)).length || 0
  
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-muted rounded-xl">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-content">Grocery List</h1>
              <p className="text-content-muted text-sm">
                {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get
                {checkedCount > 0 && `, ${checkedCount} checked off`}
              </p>
            </div>
          </div>
          
          {items && items.length > 0 && (
            <div className="flex gap-2">
              {checkedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearChecked}>
                  Clear checked
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-danger hover:text-danger">
                Clear all
              </Button>
            </div>
          )}
        </div>
        
        {/* Add manual item */}
        <div className="bg-surface-elevated rounded-xl border border-border p-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
              placeholder="Add an item manually..."
              className="flex-1 px-4 py-2 bg-surface-input border border-border rounded-lg text-content placeholder:text-content-muted focus:outline-none focus:border-primary text-sm"
            />
            <Button onClick={addManualItem} disabled={!newItem.trim() || !recordStoreReady}>
              Add
            </Button>
          </div>
        </div>
        
        {/* Empty state */}
        {(!items || items.length === 0) && (
          <div className="bg-surface-elevated rounded-xl border border-border p-12 text-center">
            <div className="w-16 h-16 bg-surface-overlay rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-content mb-2">Your grocery list is empty</h3>
            <p className="text-content-muted text-sm mb-4">
              Add items manually above, or add ingredients from your saved recipes.
            </p>
            <Link to="/recipes">
              <Button>Browse Recipes</Button>
            </Link>
          </div>
        )}
        
        {/* Grouped list */}
        {Object.entries(groupedByRecipe).map(([recipeName, recipeItems]) => (
          <div key={recipeName} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-content-secondary uppercase tracking-wide">
                {recipeName || 'Manual Items'}
              </h2>
              <span className="text-xs text-content-muted">
                ({recipeItems.filter((i) => !isGroceryChecked(i.data.checked)).length} remaining)
              </span>
            </div>
            
            <div className="bg-surface-elevated rounded-xl border border-border overflow-hidden">
              {recipeItems.map((item, idx) => {
                const done = isGroceryChecked(item.data.checked)
                return (
                <div
                  key={item.recordId}
                  className={`flex items-center gap-3 p-4 ${
                    idx > 0 ? 'border-t border-border' : ''
                  } ${done ? 'bg-surface-overlay/50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleChecked(item)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      done
                        ? 'bg-success border-success text-white'
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    {done && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  
                  <span className={`flex-1 text-sm ${
                    done ? 'text-content-muted line-through' : 'text-content'
                  }`}>
                    {item.data.ingredient}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => removeItem(item.recordId)}
                    className="flex-shrink-0 p-1.5 text-content-muted hover:text-danger rounded-lg hover:bg-danger-muted transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
