/**
 * Pantry Page - Manage ingredient inventory
 */

import { useState } from 'react'
import { useQuery, useMutations } from 'deepspace'
import { Button, Card } from '../components/ui'
import { useAuthGate } from '../hooks/useAuthGate'

interface PantryRecord {
  recordId: string
  data: {
    ingredient: string
    addedAt: string
    category?: string
  }
}

const CATEGORIES = [
  { value: 'produce', label: 'Produce', emoji: '🥬' },
  { value: 'dairy', label: 'Dairy', emoji: '🥛' },
  { value: 'meat', label: 'Meat & Protein', emoji: '🥩' },
  { value: 'pantry', label: 'Pantry Staples', emoji: '🥫' },
  { value: 'spices', label: 'Spices & Herbs', emoji: '🌿' },
  { value: 'other', label: 'Other', emoji: '📦' },
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
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-content">My Pantry</h1>
        <p className="text-content-secondary">
          Track what ingredients you have at home. We'll show you which recipes you can make!
        </p>
      </div>
      
      {/* Add Ingredient */}
      <Card className="p-4 space-y-3">
        <h2 className="text-lg font-semibold text-content">Add Ingredient</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newIngredient}
            onChange={(e) => setNewIngredient(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., eggs, milk, chicken breast..."
            className="flex-1 px-3 py-2 bg-surface-overlay border border-border rounded-lg text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-surface-overlay border border-border rounded-lg text-content focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </select>
          <Button onClick={handleAddIngredient} disabled={!newIngredient.trim()}>
            Add
          </Button>
        </div>
      </Card>
      
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search ingredients..."
          className="flex-1 px-3 py-2 bg-surface-overlay border border-border rounded-lg text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !filterCategory
                ? 'bg-primary text-white'
                : 'bg-surface-overlay text-content-secondary hover:bg-surface-elevated'
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
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filterCategory === cat.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-overlay text-content-secondary hover:bg-surface-elevated'
                }`}
              >
                {cat.emoji} {cat.label} ({count})
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Pantry Items */}
      {totalItems === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-6xl mb-4">🥫</div>
          <h3 className="text-xl font-semibold text-content mb-2">Your pantry is empty</h3>
          <p className="text-content-secondary">
            Start adding ingredients to see which recipes you can make!
          </p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-content mb-2">No ingredients found</h3>
          <p className="text-content-secondary">
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
                <h3 className="text-lg font-semibold text-content flex items-center gap-2">
                  <span className="text-2xl">{cat.emoji}</span>
                  {cat.label}
                  <span className="text-sm font-normal text-content-muted">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map(item => (
                    <Card
                      key={item.recordId}
                      className="p-3 flex items-center justify-between group hover:bg-surface-elevated transition-colors"
                    >
                      <span className="text-content capitalize">{item.data.ingredient}</span>
                      <button
                        onClick={() => handleRemoveIngredient(item.recordId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-content-muted hover:text-danger"
                        title="Remove from pantry"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Card>
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
