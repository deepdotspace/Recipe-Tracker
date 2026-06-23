/**
 * Recipe Detail Page - View and edit a single recipe
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutations, useRecordContext } from 'deepspace'
import { Button, buttonVariants, cn, useToast } from '../components/ui'
import { MEAL_TYPE_OPTIONS, MEAL_TYPE_CONFIG, type MealType } from '../constants'
import { useAuthGate } from '../hooks/useAuthGate'

interface Recipe {
  title: string
  caption: string
  ingredients: string[]
  instructions: string[]
  imageUrl: string
  instagramUrl: string
  author: string
  savedAt: string
  tags: string[]
  starred: boolean
  notes: string
  recipeSourceUrl?: string
  mealType?: string
}

interface RecipeRecord {
  recordId: string
  data: Recipe
}

interface GroceryItem {
  ingredient: string
  recipeId: string
  recipeTitle: string
  checked: boolean
  addedAt: string
}

interface GroceryRecord {
  recordId: string
  data: GroceryItem
}

// Normalize ingredient for comparison (lowercase, trim, remove extra spaces)
function normalizeIngredient(ing: string): string {
  return ing.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Volume/weight units — quantities with these get stripped (e.g. "185ml of milk" → "milk")
const MEASUREMENT_RE = /^([\d]+[\d/.\s]*)\s*(ml|milliliters?|millilitres?|l|liters?|litres?|dl|cl|cups?|tbsp|tsp|tablespoons?|teaspoons?|fl\.?\s*oz|oz|ounces?|g|grams?|kg|kilograms?|lbs?|pounds?|pints?|quarts?|gallons?)\b\s*(of\s+)?/i
// Vague amounts — stripped entirely (e.g. "a pinch of salt" → "salt")
const VAGUE_QTY_RE = /^(a\s+)?(pinch|dash|splash|handful|bunch|sprig|knob|drizzle|squeeze|glug|sprinkle|bit|touch)(es|s)?\s+(of\s+)?/i

// Simplify ingredient for grocery list: strip measurement quantities, keep countable ones
function normalizeForGrocery(ingredient: string): string {
  let s = ingredient.trim()
  const vagueMatch = s.match(VAGUE_QTY_RE)
  if (vagueMatch) {
    const rest = s.slice(vagueMatch[0].length).trim()
    return rest || s
  }
  const measureMatch = s.match(MEASUREMENT_RE)
  if (measureMatch) {
    const rest = s.slice(measureMatch[0].length).trim()
    return rest || s
  }
  return s
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { ready: recordStoreReady } = useRecordContext()
  const { success: toastSuccess, error: toastError } = useToast()
  const [addingGroceries, setAddingGroceries] = useState(false)

  const { records: recipes } = useQuery('recipes') as { records: RecipeRecord[] }
  const { put: rawPut, remove: rawRemove } = useMutations('recipes')

  const { records: groceryItems } = useQuery('groceryList') as { records: GroceryRecord[] }
  const { createConfirmed: rawAddToGrocery } = useMutations('groceryList')

  const { guard, authModal } = useAuthGate()

  // Every write is gated behind sign-in; reads stay open for anonymous browsing.
  const put = useCallback(async (recordId: string, recordData: Recipe) => {
    if (!guard()) return
    await rawPut(recordId, recordData)
  }, [guard, rawPut])
  const remove = useCallback(async (recordId: string) => {
    if (!guard()) return
    await rawRemove(recordId)
  }, [guard, rawRemove])
  const addToGroceryConfirmed = useCallback(async (recordData: GroceryItem) => {
    if (!guard()) return
    await rawAddToGrocery(recordData)
  }, [guard, rawAddToGrocery])
  
  const recipe = recipes?.find(r => r.recordId === id)
  
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [author, setAuthor] = useState('')
  const [editingIngredients, setEditingIngredients] = useState(false)
  const [ingredients, setIngredients] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [notesEdited, setNotesEdited] = useState(false)
  
  // Initialize state when recipe loads
  useEffect(() => {
    if (recipe) {
      setTitle(recipe.data.title || '')
      setAuthor(recipe.data.author || '')
      setIngredients(recipe.data.ingredients || [])
      setNotes(recipe.data.notes || '')
    }
  }, [recipe])
  
  const toggleStar = useCallback(async () => {
    if (!recipe) return
    await put(recipe.recordId, {
      ...recipe.data,
      starred: !recipe.data.starred,
    })
  }, [recipe, put])
  
  const saveTitle = useCallback(async () => {
    if (!recipe || !title.trim()) return
    await put(recipe.recordId, {
      ...recipe.data,
      title: title.trim(),
    })
    setEditingTitle(false)
  }, [recipe, title, put])
  
  const saveAuthor = useCallback(async () => {
    if (!recipe || !author.trim()) return
    await put(recipe.recordId, {
      ...recipe.data,
      author: author.trim(),
    })
    setEditingAuthor(false)
  }, [recipe, author, put])
  
  const saveIngredients = useCallback(async () => {
    if (!recipe) return
    await put(recipe.recordId, {
      ...recipe.data,
      ingredients,
    })
    setEditingIngredients(false)
  }, [recipe, ingredients, put])
  
  const saveNotes = useCallback(async () => {
    if (!recipe) return
    await put(recipe.recordId, {
      ...recipe.data,
      notes,
    })
    setNotesEdited(false)
  }, [recipe, notes, put])
  
  const addIngredient = useCallback(() => {
    setIngredients(prev => [...prev, ''])
  }, [])
  
  const updateIngredient = useCallback((index: number, value: string) => {
    setIngredients(prev => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }, [])
  
  const removeIngredient = useCallback((index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index))
  }, [])
  
  // Check which ingredients are already in grocery list
  const ingredientsInGroceryList = useMemo(() => {
    if (!groceryItems) return new Set<string>()
    return new Set(groceryItems.map(item => normalizeIngredient(item.data.ingredient)))
  }, [groceryItems])
  
  const isInGroceryList = useCallback((ingredient: string) => {
    return ingredientsInGroceryList.has(normalizeIngredient(ingredient))
      || ingredientsInGroceryList.has(normalizeIngredient(normalizeForGrocery(ingredient)))
  }, [ingredientsInGroceryList])

  const ingredientsMissingFromGrocery = useMemo(() => {
    const list = recipe?.data.ingredients ?? []
    return list.filter((ing) => ing.trim() && !isInGroceryList(ing))
  }, [recipe?.data.ingredients, isInGroceryList])

  const addIngredientToGrocery = useCallback(async (ingredient: string) => {
    if (!recipe || isInGroceryList(ingredient)) return
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    try {
      await addToGroceryConfirmed({
        ingredient: normalizeForGrocery(ingredient),
        recipeId: recipe.recordId,
        recipeTitle: recipe.data.title,
        checked: false,
        addedAt: new Date().toISOString(),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not add to grocery list'
      toastError('Failed to add item', message)
    }
  }, [recipe, isInGroceryList, addToGroceryConfirmed, recordStoreReady, toastError])

  const addAllIngredientsToGrocery = useCallback(async () => {
    if (!recipe || ingredientsMissingFromGrocery.length === 0) return
    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    setAddingGroceries(true)
    const seen = new Set<string>()
    let added = 0
    try {
      for (const ing of ingredientsMissingFromGrocery) {
        const key = normalizeIngredient(normalizeForGrocery(ing))
        if (seen.has(key)) continue
        seen.add(key)
        await addToGroceryConfirmed({
          ingredient: normalizeForGrocery(ing),
          recipeId: recipe.recordId,
          recipeTitle: recipe.data.title,
          checked: false,
          addedAt: new Date().toISOString(),
        })
        added++
      }
      if (added === 0) {
        toastSuccess('Nothing new to add', 'Those ingredients are already on your grocery list.')
      } else {
        toastSuccess(
          'Added to grocery list',
          added === 1 ? '1 ingredient added. Open Grocery to see your list.' : `${added} ingredients added. Open Grocery to see your list.`,
        )
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not add to grocery list'
      toastError('Failed to add items', message)
    } finally {
      setAddingGroceries(false)
    }
  }, [
    recipe,
    ingredientsMissingFromGrocery,
    addToGroceryConfirmed,
    recordStoreReady,
    toastError,
    toastSuccess,
  ])

  const updateMealType = useCallback(async (mealType: string) => {
    if (!recipe) return
    await put(recipe.recordId, {
      ...recipe.data,
      mealType,
    })
  }, [recipe, put])
  
  const deleteRecipe = useCallback(async () => {
    if (!recipe) return
    if (confirm('Are you sure you want to delete this recipe?')) {
      await remove(recipe.recordId)
      navigate('/recipes')
    }
  }, [recipe, remove, navigate])
  
  if (!recipe) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-elevated rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-content-secondary">Recipe not found</p>
          <Link to="/recipes" className="inline-block mt-4">
            <Button variant="secondary" size="sm">Back to recipes</Button>
          </Link>
        </div>
      </div>
    )
  }
  
  const { data } = recipe
  
  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          to="/recipes"
          className="inline-flex items-center gap-2 text-content-secondary hover:text-content text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to recipes
        </Link>
        
        {/* Header */}
        <div className="bg-surface-elevated rounded-2xl shadow-card border border-border overflow-hidden mb-6">
          <div className="flex flex-col sm:flex-row">
            {/* Image */}
            {data.imageUrl ? (
              <a
                href={data.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative w-full sm:w-48 h-48 flex-shrink-0 group"
              >
                <img
                  src={data.imageUrl}
                  alt={data.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                    <circle cx="12" cy="12" r="3.5"/>
                  </svg>
                </div>
              </a>
            ) : (
              <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-surface-overlay flex items-center justify-center">
                <svg className="w-16 h-16 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
            )}
            
            {/* Title & Meta */}
            <div className="flex-1 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle()
                          if (e.key === 'Escape') {
                            setTitle(data.title)
                            setEditingTitle(false)
                          }
                        }}
                        className="flex-1 text-2xl font-bold text-content bg-surface-input border border-border rounded-lg px-3 py-1 focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={saveTitle}
                        className="p-1.5 bg-success text-white rounded-lg hover:bg-success/90"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setTitle(data.title)
                          setEditingTitle(false)
                        }}
                        className="p-1.5 bg-surface-overlay text-content-muted rounded-lg hover:text-danger"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <h1 
                      className="text-2xl font-bold text-content cursor-pointer hover:text-primary transition-colors group"
                      onClick={() => setEditingTitle(true)}
                      title="Click to edit"
                    >
                      {data.title}
                      <svg className="w-4 h-4 inline-block ml-2 opacity-0 group-hover:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </h1>
                  )}
                  {editingAuthor ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-content-secondary">by @</span>
                      <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveAuthor()
                          if (e.key === 'Escape') {
                            setAuthor(data.author)
                            setEditingAuthor(false)
                          }
                        }}
                        className="flex-1 text-sm text-content-secondary bg-surface-input border border-border rounded-lg px-2 py-0.5 focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={saveAuthor}
                        className="p-1 bg-success text-white rounded-lg hover:bg-success/90"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setAuthor(data.author)
                          setEditingAuthor(false)
                        }}
                        className="p-1 bg-surface-overlay text-content-muted rounded-lg hover:text-danger"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <p 
                      className="text-content-secondary mt-1 cursor-pointer hover:text-primary transition-colors group/author"
                      onClick={() => setEditingAuthor(true)}
                      title="Click to edit author"
                    >
                      by @{data.author}
                      <svg className="w-3 h-3 inline-block ml-1 opacity-0 group-hover/author:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </p>
                  )}
                </div>
                <button
                  onClick={toggleStar}
                  className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                    data.starred
                      ? 'bg-warning-muted text-warning'
                      : 'bg-surface-overlay text-content-muted hover:text-warning'
                  }`}
                >
                  <svg className="w-6 h-6" fill={data.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              </div>
              
              {data.tags && data.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {data.tags.map((tag, i) => (
                    <span key={i} className="px-2.5 py-1 bg-primary-muted text-primary text-xs font-medium rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Meal Type */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-content-muted">Meal type:</span>
                <div className="flex gap-1 flex-wrap">
                  {MEAL_TYPE_OPTIONS.map(opt => {
                    const currentMealType = (data.mealType || 'other') as MealType
                    const isSelected = currentMealType === opt.value
                    const config = MEAL_TYPE_CONFIG[opt.value]
                    const selectedColorMap: Record<string, string> = {
                      warning: 'bg-warning/15 text-warning ring-1 ring-warning/30',
                      primary: 'bg-primary/15 text-primary ring-1 ring-primary/30',
                      danger: 'bg-danger/15 text-danger ring-1 ring-danger/30',
                      success: 'bg-success/15 text-success ring-1 ring-success/30',
                      muted: 'bg-surface-overlay text-content-secondary ring-1 ring-border',
                    }
                    const activeClass = selectedColorMap[config.color] || selectedColorMap.muted
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateMealType(opt.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          isSelected
                            ? activeClass
                            : 'bg-surface-overlay/50 text-content-muted hover:text-content-secondary hover:bg-surface-overlay'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Add to grocery — primary action */}
              {(data.ingredients?.length ?? 0) > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-5">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto gap-2"
                    onClick={addAllIngredientsToGrocery}
                    disabled={
                      addingGroceries ||
                      !recordStoreReady ||
                      ingredientsMissingFromGrocery.length === 0
                    }
                    loading={addingGroceries}
                    title={
                      !recordStoreReady
                        ? 'Wait for the app to finish connecting, then try again.'
                        : ingredientsMissingFromGrocery.length === 0
                          ? 'Every ingredient is already on your grocery list.'
                          : 'Add all missing ingredients to your grocery list.'
                    }
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {ingredientsMissingFromGrocery.length === 0
                      ? 'All ingredients on grocery list'
                      : `Add to grocery list (${ingredientsMissingFromGrocery.length})`}
                  </Button>
                  <Link
                    to="/grocery"
                    className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full sm:w-auto')}
                  >
                    View grocery list
                  </Link>
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-4 text-sm text-content-muted flex-wrap">
                <span>Saved {new Date(data.savedAt).toLocaleDateString()}</span>
                {data.instagramUrl && (
                  <a
                    href={data.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {data.instagramUrl.includes('instagram.com') ? 'View on Instagram' : 'View Source'}
                  </a>
                )}
                {data.recipeSourceUrl && (
                  <a
                    href={data.recipeSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-info hover:underline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    Recipe from {(() => {
                      try { return new URL(data.recipeSourceUrl).hostname.replace('www.', '') } catch { return 'website' }
                    })()}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Ingredients */}
        <div className="bg-surface-elevated rounded-2xl shadow-card border border-border overflow-hidden mb-6">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-2 justify-between">
            <h2 className="font-semibold text-content">Ingredients</h2>
            {editingIngredients ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => {
                  setIngredients(data.ingredients || [])
                  setEditingIngredients(false)
                }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveIngredients}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {(data.ingredients?.length ?? 0) > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={addAllIngredientsToGrocery}
                    disabled={
                      addingGroceries ||
                      !recordStoreReady ||
                      ingredientsMissingFromGrocery.length === 0
                    }
                    loading={addingGroceries}
                  >
                    Add to grocery
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setEditingIngredients(true)}>
                  Edit
                </Button>
              </div>
            )}
          </div>
          
          <div className="p-4">
            {editingIngredients ? (
              <div className="space-y-2">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={ing}
                      onChange={(e) => updateIngredient(i, e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface-input border border-border rounded-lg text-content text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-muted"
                      placeholder="Ingredient with amount..."
                    />
                    <button
                      onClick={() => removeIngredient(i)}
                      className="p-2 text-content-muted hover:text-danger transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addIngredient}
                  className="w-full py-2 border border-dashed border-border rounded-lg text-content-muted hover:text-content hover:border-border-strong transition-colors text-sm"
                >
                  + Add ingredient
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {(data.ingredients || []).length === 0 ? (
                  <p className="text-content-muted text-sm">No ingredients listed</p>
                ) : (
                  data.ingredients.map((ing, i) => {
                    const inList = isInGroceryList(ing)
                    const addBlocked = !recordStoreReady && !inList
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <span className="text-primary">•</span>
                        <span className="flex-1 text-content-secondary">{ing}</span>
                        <button
                          onClick={() => !inList && recordStoreReady && addIngredientToGrocery(ing)}
                          disabled={inList || addBlocked}
                          className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                            inList
                              ? 'bg-success-muted text-success cursor-default'
                              : addBlocked
                                ? 'bg-surface-overlay text-content-muted opacity-50 cursor-not-allowed'
                                : 'bg-surface-overlay text-content-muted hover:bg-primary-muted hover:text-primary'
                          }`}
                          title={
                            inList
                              ? 'Already in grocery list'
                              : addBlocked
                                ? 'Wait for the app to finish connecting, then try again.'
                                : 'Add to grocery list'
                          }
                        >
                          {inList ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            )}
          </div>
        </div>
        
        {/* Instructions */}
        <div className="bg-surface-elevated rounded-2xl shadow-card border border-border overflow-hidden mb-6">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-content">Instructions</h2>
          </div>
          
          <div className="p-4">
            {(data.instructions || []).length === 0 ? (
              <p className="text-content-muted text-sm">No instructions listed</p>
            ) : (
              <ol className="space-y-4">
                {data.instructions.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-7 h-7 bg-primary-muted text-primary rounded-full flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <p className="text-content-secondary pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        
        {/* Notes */}
        <div className="bg-surface-elevated rounded-2xl shadow-card border border-border overflow-hidden mb-6">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-content">My Notes</h2>
            {notesEdited && (
              <Button size="sm" onClick={saveNotes}>
                Save Notes
              </Button>
            )}
          </div>
          
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setNotesEdited(true)
              }}
              placeholder="Add your personal notes, modifications, or tips..."
              className="w-full h-32 px-4 py-3 bg-surface-input border border-border rounded-xl text-content placeholder:text-content-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-muted resize-none"
            />
          </div>
        </div>
        
        {/* Delete */}
        <div className="flex justify-end">
          <button
            onClick={deleteRecipe}
            className="text-sm text-content-muted hover:text-danger transition-colors"
          >
            Delete this recipe
          </button>
        </div>
      </div>

      {authModal}
    </div>
  )
}
