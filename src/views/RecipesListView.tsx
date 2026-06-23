/**
 * Recipes Page - View all saved recipes
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutations } from 'deepspace'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
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
  keyIngredients?: string[]
}

interface RecipeRecord {
  recordId: string
  data: Recipe
}

type FilterType = 'all' | 'starred'

const COMMON_STAPLES = new Set([
  'salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'vegetable oil',
  'cooking oil', 'canola oil', 'butter', 'sugar', 'flour', 'all-purpose flour',
  'garlic', 'onion', 'onions', 'ice', 'eggs', 'egg',
])

function extractCoreName(ingredient: string): string {
  let s = ingredient.toLowerCase().trim()
  s = s.replace(/^[\d\s/.,½¼¾⅓⅔⅛]+/, '').trim()
  s = s.replace(/^(ml|milliliters?|l|liters?|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|g|grams?|kg|lbs?|pounds?|pints?|quarts?)\s*/i, '').trim()
  s = s.replace(/^of\s+/i, '').trim()
  s = s.replace(/\b(large|medium|small|whole|fresh|ripe|finely|roughly|chopped|diced|sliced|minced|grated|crushed|ground|dried|frozen|canned|boneless|skinless|to taste|for garnish|optional|extra[- ]?virgin|packed|loosely)\b/gi, '')
  s = s.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
  return s
}

function getKeyIngredients(ingredients: string[], max = 4): string[] {
  if (!ingredients || ingredients.length === 0) return []
  const key: string[] = []
  for (const ing of ingredients) {
    const core = extractCoreName(ing)
    if (!core) continue
    const isStaple = COMMON_STAPLES.has(core) ||
      Array.from(COMMON_STAPLES).some((s) => core === s || core.startsWith(s + ' '))
    if (!isStaple) {
      key.push(core)
      if (key.length >= max) break
    }
  }
  return key
}

const MEAL_BADGE: Record<string, string> = {
  warning: 'bg-warning/15 text-warning',
  primary: 'bg-primary/15 text-primary',
  danger: 'bg-danger/15 text-danger',
  success: 'bg-success/15 text-success',
  muted: 'bg-secondary text-content-secondary',
}

export default function RecipesPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterType>('all')
  const [mealFilter, setMealFilter] = useState<MealType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { records: recipes } = useQuery('recipes') as { records: RecipeRecord[] }
  const { put, remove } = useMutations('recipes')
  const { guard, authModal } = useAuthGate()

  const toggleStar = useCallback((record: RecipeRecord) => guard(() =>
    put(record.recordId, { ...record.data, starred: !record.data.starred }),
  ), [guard, put])

  const deleteRecipe = useCallback((recordId: string) => guard(() => {
    if (confirm('Are you sure you want to delete this recipe?')) return remove(recordId)
  }), [guard, remove])

  const filteredRecipes = useMemo(() => {
    if (!recipes) return []
    let filtered = recipes
    if (filter === 'starred') filtered = filtered.filter((r) => r.data.starred)
    if (mealFilter !== 'all') filtered = filtered.filter((r) => (r.data.mealType || 'other') === mealFilter)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((r) =>
        r.data.title.toLowerCase().includes(query) ||
        r.data.author.toLowerCase().includes(query) ||
        r.data.tags?.some((t) => t.toLowerCase().includes(query)) ||
        (r.data.mealType && r.data.mealType.toLowerCase().includes(query)) ||
        r.data.ingredients?.some((ing) => ing.toLowerCase().includes(query)),
      )
    }
    return filtered.sort((a, b) => {
      if (a.data.starred && !b.data.starred) return -1
      if (!a.data.starred && b.data.starred) return 1
      return new Date(b.data.savedAt).getTime() - new Date(a.data.savedAt).getTime()
    })
  }, [recipes, filter, mealFilter, searchQuery])

  const starredCount = recipes?.filter((r) => r.data.starred).length || 0

  const mealTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    MEAL_TYPE_OPTIONS.forEach((opt) => { counts[opt.value] = 0 })
    recipes?.forEach((r) => {
      const mt = r.data.mealType || 'other'
      counts[mt] = (counts[mt] || 0) + 1
    })
    return counts
  }, [recipes])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Recipes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {recipes?.length || 0} saved{starredCount > 0 && ` · ${starredCount} starred`}
          </p>
        </div>
        <Link to="/home">
          <Button className="rounded-full">
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Recipe
          </Button>
        </Link>
      </div>

      {/* Search + starred */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes, authors, ingredients…"
            className="w-full rounded-full border border-border bg-card/80 py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-card backdrop-blur-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'starred'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card/60 text-content-secondary hover:text-content'
              }`}
            >
              {f === 'starred' && (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              {f === 'all' ? 'All' : 'Starred'}
            </button>
          ))}
        </div>
      </div>

      {/* Meal filter chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setMealFilter('all')}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            mealFilter === 'all' ? 'bg-foreground text-background' : 'border border-border bg-card/60 text-content-secondary hover:text-content'
          }`}
        >
          All Meals
        </button>
        {MEAL_TYPE_OPTIONS.map((opt) => {
          const count = mealTypeCounts[opt.value] || 0
          const isActiveFilter = mealFilter === opt.value
          const config = MEAL_TYPE_CONFIG[opt.value]
          return (
            <button
              key={opt.value}
              onClick={() => setMealFilter(opt.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActiveFilter ? MEAL_BADGE[config.color] + ' ring-2 ring-inset ring-current/40' : 'border border-border bg-card/60 text-content-secondary hover:text-content'
              }`}
            >
              {opt.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 text-xs font-semibold ${isActiveFilter ? 'bg-current/15' : 'bg-secondary text-muted-foreground'}`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* List */}
      {filteredRecipes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-content-secondary">
            {filter === 'starred' ? 'No starred recipes yet'
              : searchQuery ? 'No recipes match your search'
              : mealFilter !== 'all' ? `No ${(MEAL_TYPE_OPTIONS.find((o) => o.value === mealFilter)?.label || '').toLowerCase()} recipes yet`
              : 'No recipes saved yet'}
          </p>
          {!searchQuery && filter === 'all' && mealFilter === 'all' && (
            <Link to="/home" className="mt-4 inline-block">
              <Button variant="secondary" size="sm" className="rounded-full">Add your first recipe</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredRecipes.map((record) => {
            const keyIngs = (record.data.keyIngredients && record.data.keyIngredients.length > 0)
              ? record.data.keyIngredients
              : getKeyIngredients(record.data.ingredients || [])
            const mt = (record.data.mealType || 'other') as MealType
            const mealOpt = MEAL_TYPE_OPTIONS.find((o) => o.value === mt)
            const mealConfig = MEAL_TYPE_CONFIG[mt]
            return (
              <div
                key={record.recordId}
                onClick={() => navigate(`/recipes/${record.recordId}`)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card/80 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                {/* Image banner */}
                <div className="relative h-40 w-full overflow-hidden bg-secondary">
                  {record.data.imageUrl ? (
                    <img
                      src={record.data.imageUrl}
                      alt={record.data.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary/30">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(record) }}
                    className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                      record.data.starred ? 'bg-warning text-white' : 'bg-black/30 text-white hover:bg-black/45'
                    }`}
                    aria-label={record.data.starred ? 'Unstar' : 'Star'}
                  >
                    <svg className="h-4.5 w-4.5" fill={record.data.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  {mealOpt && mealConfig && (
                    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-md ${MEAL_BADGE[mealConfig.color]}`}>
                      {mealOpt.label}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="truncate font-semibold text-foreground">{record.data.title}</h3>
                  <p className="text-sm text-muted-foreground">by @{record.data.author}</p>

                  {keyIngs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {keyIngs.slice(0, 4).map((ing, i) => (
                        <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-content-secondary">
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span>{record.data.ingredients?.length || 0} ingredients · {record.data.instructions?.length || 0} steps</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRecipe(record.recordId) }}
                      className="opacity-0 transition-colors hover:text-danger group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {authModal}
    </div>
  )
}
