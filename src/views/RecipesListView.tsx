/**
 * Recipes Page - View all saved recipes
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutations } from 'deepspace'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Star, List, Clock, ArrowRight, BookOpen, ChefHat } from 'lucide-react'
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

export default function RecipesPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterType>('all')
  const [mealFilter, setMealFilter] = useState<MealType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { records: recipes } = useQuery('recipes') as { records: RecipeRecord[] }
  const { put, remove } = useMutations('recipes')
  const { guard, authModal } = useAuthGate()
  const { confirm, confirmModal } = useConfirm()

  const toggleStar = useCallback((record: RecipeRecord) => guard(() =>
    put(record.recordId, { ...record.data, starred: !record.data.starred }),
  ), [guard, put])

  const deleteRecipe = useCallback((recordId: string) => guard(() => {
    confirm(
      {
        title: 'Delete recipe?',
        description: 'This permanently removes the recipe from your list. This can’t be undone.',
        confirmText: 'Delete',
      },
      () => remove(recordId),
    )
  }), [guard, confirm, remove])

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
  const totalCount = recipes?.length || 0

  // Featured "Cook of the week": most recently starred recipe (by savedAt),
  // falling back to the newest recipe. Only when recipes exist.
  const featuredRecipe = useMemo(() => {
    if (!recipes || recipes.length === 0) return null
    const starred = recipes.filter((r) => r.data.starred)
    const pool = starred.length > 0 ? starred : recipes
    return [...pool].sort(
      (a, b) => new Date(b.data.savedAt).getTime() - new Date(a.data.savedAt).getTime(),
    )[0]
  }, [recipes])

  // Meal filter chips: All + the 4 named meal types (exclude "other").
  const mealChips = MEAL_TYPE_OPTIONS.filter((o) => o.value !== 'other')

  return (
    <div className="mx-auto max-w-[1160px] px-7 pb-16 pt-[34px]">
      {/* Header row */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary-deep">
            Your Kitchen
          </p>
          <h1 className="mt-1.5 text-[36px] font-extrabold leading-none tracking-[-0.03em] text-ink">
            My Recipes
          </h1>
          <p className="mt-2.5 text-[14.5px] text-muted-foreground">
            A cookbook of everything you’ve saved —{' '}
            <span className="font-semibold text-secondary-foreground">{totalCount} recipes</span>,{' '}
            <span className="font-semibold text-secondary-foreground">{starredCount} favorites</span>.
          </p>
        </div>
        <Link
          to="/add"
          className="inline-flex h-[46px] items-center gap-2 rounded-[14px] bg-primary px-5 text-[15px] font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary/90"
        >
          <Plus size={18} strokeWidth={2} />
          New recipe
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes, cooks, ingredients…"
            className="h-[46px] w-full rounded-[14px] border border-input bg-surface-soft pl-11 pr-4 text-[14.5px] text-body placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Meal filter chips */}
        <button
          onClick={() => setMealFilter('all')}
          className={`h-[46px] rounded-[14px] px-4 text-[14px] font-semibold transition-colors duration-150 ${
            mealFilter === 'all'
              ? 'bg-ink text-[#fdf6ec]'
              : 'border border-input bg-surface-soft text-[#8a6a4a] hover:text-ink'
          }`}
        >
          All
        </button>
        {mealChips.map((opt) => {
          const isActive = mealFilter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setMealFilter(opt.value)}
              className={`h-[46px] rounded-[14px] px-4 text-[14px] font-semibold transition-colors duration-150 ${
                isActive
                  ? 'bg-ink text-[#fdf6ec]'
                  : 'border border-input bg-surface-soft text-[#8a6a4a] hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          )
        })}

        {/* Favorites chip */}
        <button
          onClick={() => setFilter((f) => (f === 'starred' ? 'all' : 'starred'))}
          aria-pressed={filter === 'starred'}
          className={`inline-flex h-[46px] items-center gap-2 rounded-[14px] border border-input px-4 text-[14px] font-semibold text-[#a06a3a] transition-colors duration-150 ${
            filter === 'starred' ? 'bg-cream' : 'bg-surface-soft hover:bg-cream/60'
          }`}
        >
          <Star size={16} strokeWidth={2} fill={filter === 'starred' ? 'currentColor' : 'none'} />
          Favorites
        </button>
      </div>

      {/* Featured — Cook of the week */}
      {featuredRecipe && (
        <div
          onClick={() => navigate(`/recipes/${featuredRecipe.recordId}`)}
          className="group relative mb-9 h-[300px] cursor-pointer overflow-hidden rounded-[24px] bg-photo-tile shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]"
        >
          {featuredRecipe.data.imageUrl && (
            <img
              src={featuredRecipe.data.imageUrl}
              alt={featuredRecipe.data.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(95deg, rgba(46,28,16,0.9) 0%, rgba(46,28,16,0.55) 44%, rgba(46,28,16,0.06) 76%)',
            }}
          />
          <div className="absolute inset-0 flex max-w-[58%] flex-col justify-center gap-4 p-9">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-bold text-primary-foreground">
              ★ Cook of the week
            </span>
            <h2 className="text-[34px] font-extrabold leading-tight tracking-[-0.025em] text-white">
              {featuredRecipe.data.title}
            </h2>
            <p className="line-clamp-2 max-w-[42ch] text-[15px] leading-relaxed text-white/75">
              {featuredRecipe.data.caption?.trim() ||
                (featuredRecipe.data.tags?.length
                  ? featuredRecipe.data.tags.join(' · ')
                  : 'A saved favorite from your cookbook.')}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <span className="inline-flex h-[46px] items-center gap-2 rounded-[14px] bg-white px-5 text-[15px] font-bold text-primary-deep transition-colors duration-150 group-hover:bg-white/90">
                View recipe
                <ArrowRight size={18} strokeWidth={2} />
              </span>
              <span className="text-[13px] text-white/70">
                by @{featuredRecipe.data.author} · {featuredRecipe.data.ingredients?.length || 0}{' '}
                ingredients · {featuredRecipe.data.instructions?.length || 0} steps
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Section divider */}
      <div className="mb-5 flex items-center gap-4">
        <h2 className="text-[17px] font-extrabold text-ink">Recently saved</h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-surface-soft p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[14px] bg-cream text-primary">
            <BookOpen size={30} strokeWidth={1.8} />
          </div>
          <p className="text-[15px] text-body-soft">
            {filter === 'starred' ? 'No favorite recipes yet'
              : searchQuery ? 'No recipes match your search'
              : mealFilter !== 'all' ? `No ${(MEAL_TYPE_OPTIONS.find((o) => o.value === mealFilter)?.label || '').toLowerCase()} recipes yet`
              : 'No recipes saved yet'}
          </p>
          {!searchQuery && filter === 'all' && mealFilter === 'all' && (
            <Link
              to="/add"
              className="mt-5 inline-flex h-[46px] items-center gap-2 rounded-[14px] bg-primary px-5 text-[15px] font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary/90"
            >
              <Plus size={18} strokeWidth={2} />
              Add your first recipe
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((record) => {
            const keyIngs = (record.data.keyIngredients && record.data.keyIngredients.length > 0)
              ? record.data.keyIngredients
              : getKeyIngredients(record.data.ingredients || [])
            const mt = (record.data.mealType || 'other') as MealType
            const mealOpt = MEAL_TYPE_OPTIONS.find((o) => o.value === mt)
            const accent = MEAL_ACCENT[mt]
            return (
              <div
                key={record.recordId}
                onClick={() => navigate(`/recipes/${record.recordId}`)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)] transition-all duration-150 hover:-translate-y-1 hover:shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]"
              >
                {/* Image */}
                <div className="relative h-[168px] w-full overflow-hidden bg-photo-tile">
                  {record.data.imageUrl ? (
                    <img
                      src={record.data.imageUrl}
                      alt={record.data.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#c9b299]">
                      <ChefHat size={44} strokeWidth={1.4} />
                    </div>
                  )}

                  {/* Meal chip */}
                  {mealOpt && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11.5px] font-semibold shadow-[0_2px_8px_rgba(61,35,20,0.15)] backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                      <span style={{ color: accent }}>{mealOpt.label}</span>
                    </span>
                  )}

                  {/* Star button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(record) }}
                    className={`absolute right-3 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full shadow-[0_2px_8px_rgba(61,35,20,0.15)] transition-colors duration-150 ${
                      record.data.starred ? 'bg-star text-white' : 'bg-white/92 text-[#c9b7a1] backdrop-blur'
                    }`}
                    aria-label={record.data.starred ? 'Unstar' : 'Star'}
                  >
                    <Star size={17} strokeWidth={2} fill={record.data.starred ? 'currentColor' : 'none'} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="truncate text-[17px] font-bold tracking-[-0.015em] text-ink">
                    {record.data.title}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-muted-2">by @{record.data.author}</p>

                  {keyIngs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {keyIngs.slice(0, 4).map((ing, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-tag px-2 py-0.5 text-[11.5px] font-semibold capitalize text-[#8a6a4a]"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3.5">
                    <div className="flex items-center gap-4 text-[12.5px] text-muted-2">
                      <span className="inline-flex items-center gap-1.5">
                        <List size={14} strokeWidth={2} />
                        {record.data.ingredients?.length || 0} ingredients
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={14} strokeWidth={2} />
                        {record.data.instructions?.length || 0} steps
                      </span>
                      {record.data.calories != null && (
                        <span>≈{record.data.calories} kcal</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRecipe(record.recordId) }}
                      className="text-[12.5px] text-muted-2 opacity-0 transition-colors duration-150 hover:text-destructive group-hover:opacity-100"
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
      {confirmModal}
    </div>
  )
}
