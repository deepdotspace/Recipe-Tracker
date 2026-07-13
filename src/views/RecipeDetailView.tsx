/**
 * Recipe Detail Page - View and edit a single recipe
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutations, useRecordContext } from 'deepspace'
import {
  ChevronLeft,
  ShoppingCart,
  Star,
  SquarePen,
  Plus,
  Check,
  X,
  ChefHat,
  ExternalLink,
} from 'lucide-react'
import { Button, useToast } from '../components/ui'
import { RecipeImage } from '../components/RecipeImage'
import { MEAL_TYPE_OPTIONS, MEAL_ACCENT, type MealType } from '../constants'
import { useAuthGate } from '../hooks/useAuthGate'
import { useConfirm } from '../hooks/useConfirm'

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
  keyIngredients?: string[]
  calories?: number
  protein?: number
  servings?: number
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
  const { confirm, confirmModal } = useConfirm()

  // Every write is gated behind sign-in; reads stay open for anonymous browsing.
  const put = useCallback(async (recordId: string, recordData: Recipe) => {
    if (!guard()) return
    await rawPut(recordId, recordData)
  }, [guard, rawPut])
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
  
  const deleteRecipe = useCallback(() => {
    if (!recipe) return
    if (!guard()) return
    confirm(
      {
        title: 'Delete recipe?',
        description: 'This permanently removes the recipe from your list. This can’t be undone.',
        confirmText: 'Delete',
      },
      async () => {
        await rawRemove(recipe.recordId)
        navigate('/recipes')
      },
    )
  }, [recipe, guard, confirm, rawRemove, navigate])
  
  if (!recipe) {
    // Still hydrating the record store — show a light loading state rather
    // than flashing "not found".
    if (!recordStoreReady) {
      return (
        <div className="flex min-h-full items-center justify-center bg-background">
          <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
        </div>
      )
    }
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-photo-tile rounded-[18px] flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-faint" strokeWidth={1.5} />
          </div>
          <p className="text-body-soft mb-4">Recipe not found</p>
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary-deep hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to My Recipes
          </Link>
        </div>
      </div>
    )
  }

  const { data } = recipe
  const ingredientCount = data.ingredients?.length ?? 0
  const savedDate = data.savedAt
    ? new Date(data.savedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''
  const currentMealType = (data.mealType || 'other') as MealType
  const panelCard =
    'bg-card rounded-[20px] border border-border shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)] p-[22px]'

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1000px] mx-auto px-[28px] pt-[26px] pb-[72px]">
        {/* Back link */}
        <Link
          to="/recipes"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#8a6a4a] hover:text-ink transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to My Recipes
        </Link>

        <div className="grid md:grid-cols-[360px_1fr] gap-[34px] items-start">
          {/* ── Left column ─────────────────────────────────────────── */}
          <div className="md:sticky md:top-[92px] flex flex-col gap-3">
            {/* Square image card */}
            {data.imageUrl ? (
              data.instagramUrl ? (
                <a
                  href={data.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-[22px] border border-border overflow-hidden bg-photo-tile shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]"
                >
                  <RecipeImage src={data.imageUrl} alt={data.title} iconSize={56} />
                </a>
              ) : (
                <div className="aspect-square rounded-[22px] border border-border overflow-hidden bg-photo-tile shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]">
                  <RecipeImage src={data.imageUrl} alt={data.title} iconSize={56} />
                </div>
              )
            ) : (
              <div className="aspect-square rounded-[22px] border border-border overflow-hidden bg-photo-tile shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)] flex items-center justify-center">
                <ChefHat className="w-14 h-14 text-faint" strokeWidth={1.5} />
              </div>
            )}

            {/* Add all to grocery — primary action */}
            {ingredientCount > 0 && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={addAllIngredientsToGrocery}
                  loading={addingGroceries}
                  disabled={
                    addingGroceries ||
                    !recordStoreReady ||
                    ingredientsMissingFromGrocery.length === 0
                  }
                  title={
                    !recordStoreReady
                      ? 'Wait for the app to finish connecting, then try again.'
                      : ingredientsMissingFromGrocery.length === 0
                        ? 'Every ingredient is already on your grocery list.'
                        : 'Add all missing ingredients to your grocery list.'
                  }
                  className="w-full h-[50px] rounded-[14px] gap-2 text-[15px] font-bold shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)]"
                >
                  <ShoppingCart className="shrink-0" />
                  {ingredientsMissingFromGrocery.length === 0
                    ? 'All ingredients added'
                    : `Add all to grocery (${ingredientsMissingFromGrocery.length})`}
                </Button>
                <Link
                  to="/grocery"
                  className="text-center text-[13px] font-semibold text-primary-deep hover:text-primary transition-colors"
                >
                  View grocery list
                </Link>
              </div>
            )}

            {/* Favorite + Edit */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleStar}
                className={`h-[46px] rounded-[14px] bg-surface-soft border border-input flex items-center justify-center gap-2 text-[14px] font-semibold transition-colors hover:bg-cream ${
                  data.starred ? 'text-star' : 'text-[#a06a3a]'
                }`}
              >
                <Star className="w-[18px] h-[18px]" fill={data.starred ? 'currentColor' : 'none'} />
                {data.starred ? 'Favorited' : 'Favorite'}
              </button>
              <button
                onClick={() => setEditingIngredients((v) => !v)}
                className="h-[46px] rounded-[14px] bg-surface-soft border border-input flex items-center justify-center gap-2 text-[14px] font-semibold text-body-soft transition-colors hover:bg-cream"
              >
                <SquarePen className="w-[18px] h-[18px]" />
                Edit
              </button>
            </div>

            {/* Delete — quiet action */}
            <button
              onClick={deleteRecipe}
              className="self-center mt-1 text-[13px] text-muted-2 hover:text-destructive transition-colors"
            >
              Delete recipe
            </button>
          </div>

          {/* ── Right column ────────────────────────────────────────── */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Meal type selector */}
            <div className="flex items-center gap-3 flex-wrap">
              {MEAL_TYPE_OPTIONS.map((opt) => {
                const isSelected = currentMealType === opt.value
                const accent = MEAL_ACCENT[opt.value]
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateMealType(opt.value)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold transition-colors"
                    style={isSelected ? { color: accent } : undefined}
                  >
                    {isSelected && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}
                    <span className={isSelected ? '' : 'text-muted-2 font-semibold'}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Title */}
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
                  className="flex-1 min-w-0 text-[30px] font-extrabold tracking-[-0.03em] text-ink bg-surface-soft border border-input rounded-[12px] px-3 py-1 focus:outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  onClick={saveTitle}
                  className="shrink-0 w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center transition-opacity hover:opacity-90"
                  title="Save"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setTitle(data.title)
                    setEditingTitle(false)
                  }}
                  className="shrink-0 w-10 h-10 rounded-[10px] bg-surface-soft border border-input text-muted-2 flex items-center justify-center transition-colors hover:text-destructive"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                title="Click to edit"
                className="group text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink cursor-pointer inline-flex items-start gap-2"
              >
                {data.title}
                <SquarePen className="w-4 h-4 mt-3 shrink-0 text-muted-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}

            {/* Meta line */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-muted-foreground">
              {editingAuthor ? (
                <span className="inline-flex items-center gap-2">
                  by @
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
                    className="text-[14px] text-body bg-surface-soft border border-input rounded-[8px] px-2 py-0.5 focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <button
                    onClick={saveAuthor}
                    className="w-7 h-7 rounded-[8px] bg-primary text-white flex items-center justify-center transition-opacity hover:opacity-90"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setAuthor(data.author)
                      setEditingAuthor(false)
                    }}
                    className="w-7 h-7 rounded-[8px] bg-surface-soft border border-input text-muted-2 flex items-center justify-center transition-colors hover:text-destructive"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setEditingAuthor(true)}
                  title="Click to edit author"
                  className="group inline-flex items-center gap-1 hover:text-body transition-colors"
                >
                  by @{data.author}
                  <SquarePen className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}
              {savedDate && (
                <>
                  <span aria-hidden>·</span>
                  <span>Saved {savedDate}</span>
                </>
              )}
              {data.calories != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    ≈{data.calories} kcal
                    {data.protein != null && ` · ${data.protein}g protein`}
                    {data.servings != null
                      ? ` / serving (serves ${data.servings})`
                      : ' / serving'}
                  </span>
                </>
              )}
              {data.instagramUrl && (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={data.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-deep hover:text-primary transition-colors"
                  >
                    {data.instagramUrl.includes('instagram.com') ? 'View on Instagram' : 'View Source'}
                  </a>
                </>
              )}
              {data.recipeSourceUrl && (
                <>
                  <span aria-hidden>·</span>
                  <a
                    href={data.recipeSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-deep hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Recipe from{' '}
                    {(() => {
                      try {
                        return new URL(data.recipeSourceUrl).hostname.replace('www.', '')
                      } catch {
                        return 'website'
                      }
                    })()}
                  </a>
                </>
              )}
            </div>

            {/* Tags */}
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-tag text-[#8a6a4a] text-[11.5px] font-semibold"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ingredients panel */}
            <div className={panelCard}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">
                    Ingredients
                  </h2>
                  <span className="text-[13px] text-muted-2">{ingredientCount} items</span>
                </div>
                {editingIngredients ? (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIngredients(data.ingredients || [])
                        setEditingIngredients(false)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveIngredients}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {ingredientCount > 0 && (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingIngredients(true)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              {editingIngredients ? (
                <div className="space-y-2 pt-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={ing}
                        onChange={(e) => updateIngredient(i, e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 bg-surface-soft border border-input rounded-[10px] text-[14.5px] text-body focus:outline-none focus:border-primary"
                        placeholder="Ingredient with amount…"
                      />
                      <button
                        onClick={() => removeIngredient(i)}
                        className="w-[38px] shrink-0 rounded-[10px] bg-surface-soft border border-input text-muted-2 hover:text-destructive flex items-center justify-center transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addIngredient}
                    className="w-full py-2 border border-dashed border-input rounded-[10px] text-[14px] text-muted-2 hover:text-body hover:border-border transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add ingredient
                  </button>
                </div>
              ) : ingredientCount === 0 ? (
                <p className="text-muted-2 text-sm pt-3">No ingredients listed</p>
              ) : (
                <ul className="mt-1">
                  {data.ingredients.map((ing, i) => {
                    const inList = isInGroceryList(ing)
                    const addBlocked = !recordStoreReady && !inList
                    return (
                      <li
                        key={i}
                        className="group flex items-center gap-3 border-t border-[#f2e7d8] py-2.5 first:border-t-0"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span className="flex-1 text-[14.5px] text-body">{ing}</span>
                        <button
                          onClick={() => !inList && recordStoreReady && addIngredientToGrocery(ing)}
                          disabled={inList || addBlocked}
                          className={`w-[30px] h-[30px] shrink-0 rounded-[9px] flex items-center justify-center transition-all ${
                            inList
                              ? 'bg-success/15 text-success cursor-default'
                              : addBlocked
                                ? 'bg-note text-[#a06a3a] opacity-40 cursor-not-allowed'
                                : 'bg-note text-[#a06a3a] opacity-70 group-hover:opacity-100 hover:brightness-95'
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
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Method panel */}
            <div className={panelCard}>
              <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-ink mb-3">
                Method
              </h2>
              {(data.instructions || []).length === 0 ? (
                <p className="text-muted-2 text-sm">No instructions listed</p>
              ) : (
                <ol className="space-y-4">
                  {data.instructions.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="shrink-0 w-[30px] h-[30px] rounded-[10px] bg-cream text-primary text-[14px] font-extrabold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-[15px] leading-[1.6] text-body pt-1">{step}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* My notes panel */}
            <div className="bg-note rounded-[20px] border border-border p-[22px]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">
                  My notes
                </h2>
                {notesEdited && (
                  <Button size="sm" onClick={saveNotes}>
                    Save
                  </Button>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setNotesEdited(true)
                }}
                placeholder="Add your tweaks, timings, and tips…"
                className="w-full h-32 px-4 py-3 bg-surface-soft border border-input rounded-[12px] text-[14.5px] text-body placeholder:text-muted-2 focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {authModal}
      {confirmModal}
    </div>
  )
}
