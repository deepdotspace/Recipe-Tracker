/**
 * Recipes Page - View all saved recipes
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutations } from 'deepspace'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { MEAL_TYPE_OPTIONS, MEAL_TYPE_CONFIG, type MealType } from '../constants'

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

// Common pantry staples that aren't interesting to highlight as "key ingredients"
const COMMON_STAPLES = new Set([
  'salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'vegetable oil',
  'cooking oil', 'canola oil', 'butter', 'sugar', 'flour', 'all-purpose flour',
  'garlic', 'onion', 'onions', 'ice', 'eggs', 'egg',
])

// Strip measurements and prep words to get the core ingredient name
function extractCoreName(ingredient: string): string {
  let s = ingredient.toLowerCase().trim()
  // Strip leading numbers/fractions and measurements
  s = s.replace(/^[\d\s/.,½¼¾⅓⅔⅛]+/, '').trim()
  s = s.replace(/^(ml|milliliters?|l|liters?|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|g|grams?|kg|lbs?|pounds?|pints?|quarts?)\s*/i, '').trim()
  s = s.replace(/^of\s+/i, '').trim()
  // Strip prep adjectives
  s = s.replace(/\b(large|medium|small|whole|fresh|ripe|finely|roughly|chopped|diced|sliced|minced|grated|crushed|ground|dried|frozen|canned|boneless|skinless|to taste|for garnish|optional|extra[- ]?virgin|packed|loosely)\b/gi, '')
  s = s.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
  return s
}

// Get key ingredients: filter out common staples, return the most notable ones
function getKeyIngredients(ingredients: string[], max: number = 4): string[] {
  if (!ingredients || ingredients.length === 0) return []
  
  const key: string[] = []
  for (const ing of ingredients) {
    const core = extractCoreName(ing)
    if (!core) continue
    // Check if any staple word matches
    const isStaple = COMMON_STAPLES.has(core) || 
      Array.from(COMMON_STAPLES).some(s => core === s || core.startsWith(s + ' '))
    if (!isStaple) {
      key.push(core)
      if (key.length >= max) break
    }
  }
  return key
}

export default function RecipesPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterType>('all')
  const [mealFilter, setMealFilter] = useState<MealType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const { records: recipes } = useQuery('recipes') as { records: RecipeRecord[] }
  const { put, remove } = useMutations('recipes')
  
  const toggleStar = useCallback(async (record: RecipeRecord) => {
    await put(record.recordId, {
      ...record.data,
      starred: !record.data.starred,
    })
  }, [put])
  
  const deleteRecipe = useCallback(async (recordId: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      await remove(recordId)
    }
  }, [remove])
  
  const filteredRecipes = useMemo(() => {
    if (!recipes) return []
    
    let filtered = recipes
    
    // Filter by starred
    if (filter === 'starred') {
      filtered = filtered.filter(r => r.data.starred)
    }
    
    // Filter by meal type
    if (mealFilter !== 'all') {
      filtered = filtered.filter(r => (r.data.mealType || 'other') === mealFilter)
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r => 
        r.data.title.toLowerCase().includes(query) ||
        r.data.author.toLowerCase().includes(query) ||
        r.data.tags?.some(t => t.toLowerCase().includes(query)) ||
        (r.data.mealType && r.data.mealType.toLowerCase().includes(query)) ||
        r.data.ingredients?.some(ing => ing.toLowerCase().includes(query))
      )
    }
    
    // Sort: starred first, then by date
    return filtered.sort((a, b) => {
      if (a.data.starred && !b.data.starred) return -1
      if (!a.data.starred && b.data.starred) return 1
      return new Date(b.data.savedAt).getTime() - new Date(a.data.savedAt).getTime()
    })
  }, [recipes, filter, mealFilter, searchQuery])
  
  const starredCount = recipes?.filter(r => r.data.starred).length || 0
  
  // Count recipes per meal type
  const mealTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    MEAL_TYPE_OPTIONS.forEach(opt => { counts[opt.value] = 0 })
    recipes?.forEach(r => {
      const mt = r.data.mealType || 'other'
      counts[mt] = (counts[mt] || 0) + 1
    })
    return counts
  }, [recipes])
  
  return (
    <div className="h-full bg-surface overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-content">My Recipes</h1>
            <p className="text-content-secondary text-sm mt-1">
              {recipes?.length || 0} recipes saved
              {starredCount > 0 && ` • ${starredCount} starred`}
            </p>
          </div>
          <Link to="/home">
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Recipe
            </Button>
          </Link>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes..."
              className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-content placeholder:text-content-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-muted transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-surface-elevated border border-border text-content-secondary hover:text-content'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('starred')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                filter === 'starred'
                  ? 'bg-primary text-white'
                  : 'bg-surface-elevated border border-border text-content-secondary hover:text-content'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Starred
            </button>
          </div>
        </div>
        
        {/* Meal Type Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setMealFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              mealFilter === 'all'
                ? 'bg-surface-elevated border-2 border-primary text-primary shadow-sm'
                : 'bg-surface-elevated border border-border text-content-secondary hover:text-content'
            }`}
          >
            All Meals
          </button>
          {MEAL_TYPE_OPTIONS.map(opt => {
            const count = mealTypeCounts[opt.value] || 0
            const isActive = mealFilter === opt.value
            const colorMap: Record<string, { active: string; badge: string }> = {
              warning: { active: 'border-2 border-warning text-warning shadow-sm', badge: 'bg-warning/15 text-warning' },
              primary: { active: 'border-2 border-primary text-primary shadow-sm', badge: 'bg-primary/15 text-primary' },
              danger: { active: 'border-2 border-danger text-danger shadow-sm', badge: 'bg-danger/15 text-danger' },
              success: { active: 'border-2 border-success text-success shadow-sm', badge: 'bg-success/15 text-success' },
              muted: { active: 'border-2 border-border-strong text-content shadow-sm', badge: 'bg-surface-overlay text-content-secondary' },
            }
            const config = MEAL_TYPE_CONFIG[opt.value]
            const colors = colorMap[config.color] || colorMap.muted
            return (
              <button
                key={opt.value}
                onClick={() => setMealFilter(opt.value)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 bg-surface-elevated ${
                  isActive ? colors.active : 'border border-border text-content-secondary hover:text-content'
                }`}
              >
                {opt.label}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? colors.badge : 'bg-surface-overlay text-content-muted'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        
        {/* Recipe List */}
        {filteredRecipes.length === 0 ? (
          <div className="bg-surface-elevated rounded-2xl border border-border p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-overlay rounded-2xl flex items-center justify-center">
              {filter === 'starred' ? (
                <svg className="w-8 h-8 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              ) : searchQuery ? (
                <svg className="w-8 h-8 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              ) : (
                <svg className="w-8 h-8 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              )}
            </div>
            <p className="text-content-secondary">
              {filter === 'starred'
                ? 'No starred recipes yet'
                : searchQuery
                ? 'No recipes match your search'
                : mealFilter !== 'all'
                ? `No ${(MEAL_TYPE_OPTIONS.find((o) => o.value === mealFilter)?.label || '').toLowerCase()} recipes yet`
                : 'No recipes saved yet'}
            </p>
            {!searchQuery && filter === 'all' && mealFilter === 'all' && (
              <Link to="/home" className="inline-block mt-4">
                <Button variant="secondary" size="sm">Add your first recipe</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecipes.map((record) => (
              <div
                key={record.recordId}
                onClick={() => navigate(`/recipes/${record.recordId}`)}
                className="bg-surface-elevated rounded-2xl shadow-card border border-border overflow-hidden hover:shadow-card-hover transition-shadow cursor-pointer"
              >
                <div className="flex">
                  {/* Image */}
                  {record.data.imageUrl && record.data.instagramUrl ? (
                    <a
                      href={record.data.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="relative w-32 h-32 flex-shrink-0 group"
                    >
                      <img
                        src={record.data.imageUrl}
                        alt={record.data.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                          <circle cx="12" cy="12" r="3.5"/>
                        </svg>
                      </div>
                    </a>
                  ) : record.data.imageUrl ? (
                    <div className="w-32 h-32 flex-shrink-0 bg-surface-overlay flex items-center justify-center">
                      <img
                        src={record.data.imageUrl}
                        alt={record.data.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 flex-shrink-0 bg-surface-overlay flex items-center justify-center">
                      <svg className="w-10 h-10 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-content truncate">{record.data.title}</h3>
                        <p className="text-content-secondary text-sm">by @{record.data.author}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStar(record) }}
                        className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                          record.data.starred
                            ? 'text-warning'
                            : 'text-content-muted hover:text-warning'
                        }`}
                      >
                        <svg className="w-5 h-5" fill={record.data.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2 text-xs text-content-muted flex-wrap">
                      {/* Meal type badge */}
                      {(() => {
                        const mt = (record.data.mealType || 'other') as MealType
                        const opt = MEAL_TYPE_OPTIONS.find((o) => o.value === mt)
                        const config = MEAL_TYPE_CONFIG[mt]
                        if (!opt || !config) return null
                        const badgeColorMap: Record<string, string> = {
                          warning: 'bg-warning/10 text-warning',
                          primary: 'bg-primary/10 text-primary',
                          danger: 'bg-danger/10 text-danger',
                          success: 'bg-success/10 text-success',
                          muted: 'bg-surface-overlay text-content-secondary',
                        }
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${badgeColorMap[config.color] || badgeColorMap.muted}`}>
                            {opt.label}
                          </span>
                        )
                      })()}
                      
                      <span>{record.data.ingredients?.length || 0} ingredients</span>
                      <span>{record.data.instructions?.length || 0} steps</span>
                      {record.data.notes && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          Notes
                        </span>
                      )}
                    </div>
                    
                    {/* Key Ingredients — prefer LLM-determined, fall back to heuristic for old recipes */}
                    {(() => {
                      const keyIngs = (record.data.keyIngredients && record.data.keyIngredients.length > 0)
                        ? record.data.keyIngredients
                        : getKeyIngredients(record.data.ingredients || [])
                      if (keyIngs.length === 0) return null
                      return (
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          <svg className="w-3 h-3 text-content-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                          {keyIngs.slice(0, 5).map((ing, i) => (
                            <span key={i} className="px-2 py-0.5 bg-surface-overlay text-content-secondary text-xs rounded-full border border-border capitalize">
                              {ing}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                    
                    <div className="flex items-center justify-between mt-auto pt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteRecipe(record.recordId) }}
                        className="text-xs text-content-muted hover:text-danger transition-colors"
                      >
                        Delete
                      </button>
                      <svg className="w-4 h-4 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
