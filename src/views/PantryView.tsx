/**
 * Pantry Page - Manage ingredient inventory
 */

import { useState, type ComponentType } from 'react'
import { useQuery, useMutations } from 'deepspace'
import { Carrot, Milk, Beef, Wheat, Leaf, Package, Search, X, ChefHat } from 'lucide-react'
import { Card, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui'
import { useAuthGate } from '../hooks/useAuthGate'

interface PantryRecord {
  recordId: string
  data: {
    ingredient: string
    addedAt: string
    category?: string
  }
}

const CATEGORIES: { value: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: 'produce', label: 'Produce', Icon: Carrot },
  { value: 'dairy', label: 'Dairy', Icon: Milk },
  { value: 'meat', label: 'Meat & Protein', Icon: Beef },
  { value: 'pantry', label: 'Pantry Staples', Icon: Wheat },
  { value: 'spices', label: 'Spices & Herbs', Icon: Leaf },
  { value: 'other', label: 'Other', Icon: Package },
]

export default function PantryPage() {
  const { records: pantryItems } = useQuery('pantry') as { records: PantryRecord[] }
  const { create, remove } = useMutations('pantry')
  const { guard, authModal } = useAuthGate()

  const [newIngredient, setNewIngredient] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('other')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  const handleAddIngredient = () => guard(async () => {
    if (!newIngredient.trim()) return
    await create({
      ingredient: newIngredient.trim().toLowerCase(),
      addedAt: new Date().toISOString(),
      category: selectedCategory,
    })
    setNewIngredient('')
  })

  const handleRemoveIngredient = (recordId: string) => guard(() => remove(recordId))
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddIngredient()
    }
  }
  
  // Filter and sort pantry items
  const filteredItems = pantryItems
    ?.filter(item => {
      const matchesSearch = item.data.ingredient.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = !filterCategory || item.data.category === filterCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => a.data.ingredient.localeCompare(b.data.ingredient)) || []
  
  // Group items by category
  const itemsByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = filteredItems.filter(item => item.data.category === cat.value)
    return acc
  }, {} as Record<string, PantryRecord[]>)
  
  const totalItems = pantryItems?.length || 0
  
  return (
    <div className="mx-auto max-w-[680px] px-7 py-10 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary-deep">
          Your Shelf
        </span>
        <h1 className="text-[36px] font-extrabold tracking-[-0.03em] text-ink max-sm:text-3xl">
          My Pantry
        </h1>
        <p className="text-[14.5px] text-muted-foreground">
          Track what ingredients you have at home. We'll show you which recipes you can make!
        </p>
      </div>

      {/* Add Ingredient */}
      <Card className="rounded-[16px] p-4 space-y-3">
        <h2 className="text-[15px] font-bold text-ink">Add Ingredient</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newIngredient}
            onChange={(e) => setNewIngredient(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., eggs, milk, chicken breast..."
            className="h-[46px] flex-1 rounded-[13px] border border-input bg-surface-soft px-4 text-[14.5px] text-body placeholder:text-muted-2 focus:border-primary focus:outline-none"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-[46px] rounded-[13px] border-input bg-surface-soft sm:w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  <span className="flex items-center gap-2">
                    <cat.Icon className="h-4 w-4 text-muted-foreground" />
                    {cat.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleAddIngredient}
            disabled={!newIngredient.trim()}
            className="flex h-[46px] shrink-0 items-center justify-center rounded-[12px] bg-primary px-5 text-[14px] font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </Card>
      
      {/* Search and Filter */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search ingredients..."
            className="h-[46px] w-full rounded-[13px] border border-input bg-surface-soft pl-11 pr-4 text-[14.5px] text-body placeholder:text-muted-2 focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterCategory(null)}
            className={`flex h-[42px] shrink-0 items-center whitespace-nowrap rounded-[13px] px-4 text-[13.5px] font-semibold transition-colors duration-150 ${
              !filterCategory
                ? 'bg-ink text-[#fdf6ec]'
                : 'border border-input bg-surface-soft text-[#8a6a4a] hover:text-ink'
            }`}
          >
            All ({totalItems})
          </button>
          {CATEGORIES.map(cat => {
            const count = itemsByCategory[cat.value]?.length || 0
            if (count === 0 && filterCategory !== cat.value) return null
            return (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`flex h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[13px] px-4 text-[13.5px] font-semibold transition-colors duration-150 ${
                  filterCategory === cat.value
                    ? 'bg-ink text-[#fdf6ec]'
                    : 'border border-input bg-surface-soft text-[#8a6a4a] hover:text-ink'
                }`}
              >
                <cat.Icon className="h-4 w-4" /> {cat.label} ({count})
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Pantry Items */}
      {totalItems === 0 ? (
        <Card className="rounded-[16px] p-8 text-center">
          <ChefHat className="mx-auto mb-4 h-12 w-12 text-faint" />
          <h3 className="mb-2 text-[18px] font-bold text-ink">Your pantry is empty</h3>
          <p className="text-[14.5px] text-body-soft">
            Start adding ingredients to see which recipes you can make!
          </p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="rounded-[16px] p-8 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-faint" />
          <h3 className="mb-2 text-[18px] font-bold text-ink">No ingredients found</h3>
          <p className="text-[14.5px] text-body-soft">
            Try a different search term or category
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const items = itemsByCategory[cat.value]
            if (items.length === 0) return null

            return (
              <div key={cat.value} className="space-y-2">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink">
                  <cat.Icon className="h-5 w-5 text-primary-deep" />
                  {cat.label}
                  <span className="text-[13px] font-semibold text-muted-2">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(item => (
                    <div
                      key={item.recordId}
                      className="group flex items-center justify-between rounded-[13px] border border-input bg-tag px-3.5 py-2.5 transition-colors"
                    >
                      <span className="text-[14px] font-medium capitalize text-secondary-foreground">{item.data.ingredient}</span>
                      <button
                        onClick={() => handleRemoveIngredient(item.recordId)}
                        className="text-muted-2 opacity-0 transition-opacity duration-150 hover:text-primary-deep group-hover:opacity-100"
                        title="Remove from pantry"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
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
