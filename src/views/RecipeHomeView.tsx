/**
 * Home Page - Extract Recipes from Instagram or any website
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutations, useRecordContext, integration } from 'deepspace'
import { useNavigate, Link } from 'react-router-dom'
import { Button, useToast } from '../components/ui'
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
  mealType?: MealType
  keyIngredients?: string[]
}

interface RecipeRecord {
  recordId: string
  data: Recipe
}

/** OpenAI chat completion — api-worker returns handler output inside `data` */
type OpenAIChatCompletionData = {
  choices: Array<{ message: { content: string } }>
}

type FirecrawlSearchIntegrationData = {
  data: Array<{ markdown?: string; url?: string }>
}

type InstagramExtractIntegrationData = {
  caption: string
  mediaUrls?: string[]
  permalink?: string
  author?: { username?: string }
}

type FirecrawlScrapeIntegrationData = {
  data: { markdown?: string; metadata?: { title?: string } }
}

const RECIPE_SYSTEM_PROMPT = `You are a recipe parser. Extract structured recipe data from the provided content.

IMPORTANT: Always output in English, regardless of the original language. Translate all content to English.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "title": "Recipe name (short, catchy, in English)",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "tags": ["tag1", "tag2"],
  "mealType": "breakfast" | "dinner" | "dessert" | "snack" | "other",
  "keyIngredients": ["ingredient1", "ingredient2", "ingredient3"]
}

Rules:
- Always translate everything to English
- Title should be concise (max 60 chars), the dish name in English
- Extract EVERY SINGLE ingredient mentioned — do NOT skip or summarize. Include ALL items, even common ones like salt, pepper, oil, water, garnishes, and optional ingredients
- Ingredients should include amounts/measurements when mentioned, in English
- Instructions should be clear, numbered steps, in English. Include ALL steps from start to finish — do not truncate or combine steps
- Tags should be relevant food/cuisine categories in English (no hashtag symbol)
- keyIngredients: Pick 3-5 ingredients that are the STAR or most distinctive/uncommon ingredients of the dish — the ones that define what makes this recipe special. Do NOT include basic pantry staples (salt, pepper, oil, butter, flour, sugar, garlic, onion, water, eggs). Focus on the hero proteins, cheeses, produce, sauces, or specialty items that someone would need to specifically shop for. Use simple lowercase names without amounts (e.g., "burrata", "saffron", "lamb shoulder", "miso paste").
- mealType: classify the recipe into one of these categories:
  - "breakfast" — morning meals, brunch items (pancakes, eggs, oatmeal, smoothie bowls, etc.)
  - "dinner" — main meals, lunch/dinner entrees (pasta, stir-fry, steak, salads, soups, etc.)
  - "dessert" — sweets, baked goods, cakes, cookies, ice cream, etc.
  - "snack" — light bites, appetizers, dips, finger food, etc.
  - "other" — drinks, sauces, condiments, or anything that doesn't clearly fit above
- If the content mentions a specific dish or food item by name but doesn't include the full recipe details (e.g., a social media caption teasing a recipe, or a truncated post), still extract the dish name as the title and return empty ingredients/instructions arrays. This is important so we can search for the full recipe elsewhere.
- ONLY return {"title": "Not a recipe", "ingredients": [], "instructions": [], "tags": [], "mealType": "other"} if the content has absolutely nothing to do with food or cooking.
- Always return valid JSON, nothing else`

function isInstagramUrl(url: string): boolean {
  return url.includes('instagram.com') || url.includes('instagr.am')
}

// Detect if a caption was truncated by the Instagram API.
// The API often returns an oEmbed-style snippet that cuts off with "..."
// and/or is very short compared to the full caption visible on Instagram.
function isCaptionTruncated(caption: string): boolean {
  const trimmed = caption.trim()
  // Ends with ellipsis (literal or unicode)
  if (trimmed.endsWith('...') || trimmed.endsWith('\u2026')) return true
  // Very short for a recipe caption (real recipe captions are typically 500+ chars)
  if (trimmed.length < 300) return true
  return false
}

const VALID_MEAL_TYPES = ['breakfast', 'dinner', 'dessert', 'snack', 'other'] as const

function toMealType(value: string): MealType {
  return VALID_MEAL_TYPES.includes(value as MealType) ? (value as MealType) : 'other'
}

async function parseRecipeWithAI(caption: string): Promise<{ title: string; ingredients: string[]; instructions: string[]; tags: string[]; mealType: string; keyIngredients: string[] }> {
  try {
    // Must use `integration/endpoint` (two path segments) — see worker `/api/integrations/:name/:endpoint`
    const response = await integration.post<OpenAIChatCompletionData>('openai/chat-completion', {
      messages: [
        { role: 'system', content: RECIPE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Parse this content into a recipe. Extract EVERY ingredient and ALL steps — do not stop early:\n\n${caption}`,
        },
      ],
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 8192,
    })
    
    const reply = response.data?.choices?.[0]?.message?.content
    if (!response.success || !reply) {
      throw new Error('Failed to parse recipe')
    }
    
    let jsonText = reply.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    
    const parsed = JSON.parse(jsonText)
    const mealType = VALID_MEAL_TYPES.includes(parsed.mealType) ? parsed.mealType : 'other'
    return {
      title: parsed.title || 'Untitled Recipe',
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      mealType,
      keyIngredients: Array.isArray(parsed.keyIngredients) ? parsed.keyIngredients : [],
    }
  } catch (err) {
    console.error('AI parsing failed:', err)
    const lines = caption.split('\n').filter(l => l.trim())
    return {
      title: lines[0]?.slice(0, 60) || 'Untitled Recipe',
      ingredients: [],
      instructions: [],
      tags: [],
      mealType: 'other',
      keyIngredients: [],
    }
  }
}

// Try to extract an Instagram username from the URL or permalink
// Handles formats like: instagram.com/username/reel/CODE/, instagram.com/username/p/CODE/
function extractUsernameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    // Match: /username/p/CODE or /username/reel/CODE or /username/reels/CODE
    const match = pathname.match(/^\/([^/]+)\/(p|reel|reels)\//)
    if (match) {
      const candidate = match[1]
      // Exclude Instagram's own path segments
      const reserved = ['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'about', 'developer']
      if (!reserved.includes(candidate.toLowerCase())) {
        return candidate
      }
    }
  } catch {
    // ignore
  }
  return null
}

// Try to extract a dish/recipe name from an Instagram caption.
// This is used as a fallback when the AI parser returns "Not a recipe"
// for truncated captions that clearly mention a dish (e.g., oEmbed snippets
// like: '619K likes - carlys_cookbook: "Roasted Tomato Burrata Dip..."').
function extractDishNameFromCaption(caption: string): string | null {
  // Instagram oEmbed captions often start with stats then have the actual content after ": "
  // e.g., '619K likes, 3,747 comments - username on DATE: "CONTENT..."'
  const oembedMatch = caption.match(/:\s*"(.+)/s)
  const content = oembedMatch ? oembedMatch[1] : caption

  // Remove emojis (both unicode emoji blocks and common food emoji)
  const cleaned = content
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}]/gu, '')
    .trim()

  // Take the first line/sentence — that's typically the dish name
  const firstLine = cleaned.split(/[\n\r]/).map(l => l.trim()).filter(l => l.length > 2)[0] || ''

  // Remove common Instagram CTAs that follow the dish name
  const withoutCTA = firstLine
    .replace(/\s*\(?\s*comment\s+['"]?\w+['"]?\s*(and|&)\s*.*/i, '')
    .replace(/\s*link\s+in\s+bio.*/i, '')
    .replace(/\s*save\s+(this|for)\s+later.*/i, '')
    .replace(/\s*tag\s+a\s+friend.*/i, '')
    .replace(/\s*recipe\s+(below|in\s+(bio|comments|caption)).*/i, '')
    .trim()

  // Remove trailing punctuation and parentheses
  const trimmed = withoutCTA
    .replace(/[!?.,;:]+$/, '')
    .replace(/\s*\([^)]*$/, '') // remove unclosed parenthetical
    .trim()

  // Sanity check: must be reasonable length for a dish name
  if (trimmed.length >= 3 && trimmed.length <= 200) {
    return trimmed
  }

  return null
}

// Try to extract an Instagram username from caption text (look for common patterns)
function extractAuthorFromCaption(caption: string): string | null {
  // Look for patterns like "by @username", "from @username", "credit: @username", "recipe by @username"
  const creditMatch = caption.match(/(?:by|from|credit[s]?[:\s]|recipe\s+by|source[:\s]|via)\s*@([\w.]+)/i)
  if (creditMatch) return creditMatch[1]
  
  // If only one @mention in the entire caption, it's likely the author
  const allMentions = caption.match(/@([\w.]+)/g)
  if (allMentions && allMentions.length === 1) {
    return allMentions[0].slice(1) // remove the @
  }
  
  return null
}

// Try a single search query and return parsed recipe if found
async function trySearchQuery(
  query: string
): Promise<{ ingredients: string[]; instructions: string[]; tags: string[]; mealType: string; keyIngredients: string[]; sourceUrl: string } | null> {
  try {
    const searchResponse = await integration.post<FirecrawlSearchIntegrationData>('firecrawl/search', {
      query,
      limit: 3,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
      },
    })
    
    if (!searchResponse.success || !searchResponse.data?.data?.length) {
      return null
    }
    
    // Try each result until we find one with a valid recipe
    for (const result of searchResponse.data.data) {
      const markdown = result.markdown
      if (!markdown || markdown.length < 100) continue
      
      // Parse the scraped content for recipe data
      const parsed = await parseRecipeWithAI(markdown)
      
      if (
        parsed.title !== 'Not a recipe' &&
        parsed.ingredients.length > 0 &&
        parsed.instructions.length > 0
      ) {
        return {
          ingredients: parsed.ingredients,
          instructions: parsed.instructions,
          tags: parsed.tags,
          mealType: parsed.mealType,
          keyIngredients: parsed.keyIngredients,
          sourceUrl: result.url || '',
        }
      }
    }
    
    return null
  } catch (err) {
    console.error('Search query failed:', err)
    return null
  }
}

// Search the web for a recipe when Instagram caption doesn't contain recipe details.
// Tries multiple search strategies for best results.
async function searchWebForRecipe(
  recipeTitle: string,
  authorUsername: string
): Promise<{ ingredients: string[]; instructions: string[]; tags: string[]; mealType: string; keyIngredients: string[]; sourceUrl: string } | null> {
  const hasAuthor = authorUsername && authorUsername !== 'Unknown'
  
  // Strategy 1: Search with author name (most targeted — matches the user's approach
  // of searching "recipe name + instagram username")
  if (hasAuthor) {
    const result = await trySearchQuery(`${recipeTitle} ${authorUsername} recipe`)
    if (result) return result
  }
  
  // Strategy 2: Search without quotes, just the recipe title + "recipe"
  // (works when author is unknown or Strategy 1 missed)
  const result = await trySearchQuery(`${recipeTitle} recipe ingredients instructions`)
  if (result) return result
  
  return null
}

export default function HomePage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<'extract' | 'scrape' | 'parse' | 'websearch'>('extract')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Partial<Recipe> | null>(null)
  const [debugInfo, setDebugInfo] = useState<{ rawCaption: string; truncated: boolean; aiParsed: { title: string; ingredients: string[]; instructions: string[]; tags: string[] } } | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [savingRecipe, setSavingRecipe] = useState(false)

  const { ready: recordStoreReady } = useRecordContext()
  const { success: toastSuccess, error: toastError } = useToast()
  
  const { records: recipes } = useQuery('recipes') as { records: RecipeRecord[] }
  const { createConfirmed } = useMutations('recipes')
  
  const recentRecipes = recipes?.slice(0, 4) || []
  
  const extractFromInstagram = useCallback(async (targetUrl: string) => {
    setLoadingStep('extract')
    
    const response = await integration.post<InstagramExtractIntegrationData>('instagram/extract-content', {
      url: targetUrl,
    })
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to extract content from Instagram')
    }
    
    const { caption, mediaUrls, permalink, author } = response.data
    
    if (!caption) {
      throw new Error('No caption found in this Instagram post')
    }
    
    // Try multiple strategies for author extraction:
    // 1. API author field (most reliable)
    // 2. Extract username from permalink/URL (e.g. instagram.com/username/reel/CODE)
    // 3. Extract from caption @mentions (fallback)
    let authorName = author?.username || ''
    if (!authorName) {
      authorName = extractUsernameFromUrl(permalink || '') || extractUsernameFromUrl(targetUrl) || ''
    }
    if (!authorName) {
      authorName = extractAuthorFromCaption(caption) || 'Unknown'
    }
    
    return {
      content: caption,
      imageUrl: mediaUrls?.[0] || '',
      sourceUrl: permalink || targetUrl,
      author: authorName,
      truncated: isCaptionTruncated(caption),
    }
  }, [])
  
  const extractFromWebsite = useCallback(async (targetUrl: string) => {
    setLoadingStep('scrape')
    
    const response = await integration.post<FirecrawlScrapeIntegrationData>('firecrawl/scrape', {
      url: targetUrl,
      formats: ['markdown'],
      onlyMainContent: true,
    })
    
    if (!response.success || !response.data?.data) {
      throw new Error(response.error || 'Failed to scrape website')
    }
    
    const { markdown, metadata } = response.data.data
    
    if (!markdown || markdown.length < 50) {
      throw new Error('Could not extract content from this page')
    }
    
    // Try to extract domain as author
    let author = 'Unknown'
    try {
      const domain = new URL(targetUrl).hostname.replace('www.', '')
      author = domain
    } catch {
      // ignore
    }
    
    return {
      content: markdown,
      imageUrl: '', // Websites don't give us a clean image URL
      sourceUrl: targetUrl,
      author,
      title: metadata?.title || '',
    }
  }, [])
  
  const extractRecipe = useCallback(async () => {
    if (!url.trim()) return
    
    setLoading(true)
    setError(null)
    setPreview(null)
    setDebugInfo(null)
    setShowDebug(false)
    
    try {
      const targetUrl = url.trim()
      let extracted: { content: string; imageUrl: string; sourceUrl: string; author: string; title?: string; truncated?: boolean }
      
      if (isInstagramUrl(targetUrl)) {
        extracted = await extractFromInstagram(targetUrl)
        
        // If the Instagram API returned a truncated caption, try scraping
        // the Instagram page directly to get the full text
        if (extracted.truncated) {
          setLoadingStep('scrape')
          try {
            const scrapeResponse = await integration.post<FirecrawlScrapeIntegrationData>('firecrawl/scrape', {
              url: targetUrl,
              formats: ['markdown'],
              onlyMainContent: true,
            })
            const scraped = scrapeResponse?.data?.data?.markdown
            // Only use scraped content if it's substantially longer than the truncated caption
            if (scraped && scraped.length > extracted.content.length + 50) {
              extracted = { ...extracted, content: scraped, truncated: false }
            }
          } catch {
            // Scraping Instagram can fail — that's fine, we'll fall back to web search
          }
        }
      } else {
        extracted = await extractFromWebsite(targetUrl)
      }
      
      setLoadingStep('parse')
      const parsed = await parseRecipeWithAI(extracted.content)
      
      // Store debug info for inspection
      setDebugInfo({
        rawCaption: extracted.content,
        truncated: extracted.truncated === true,
        aiParsed: { ...parsed },
      })
      
      // If the caption was truncated by Instagram or the parsed data looks incomplete,
      // search the web for the full recipe (e.g., from the author's blog).
      // This is critical because the Instagram API often returns only a short snippet
      // of the full caption, cutting off ingredient lists and instructions.
      // For Instagram, we attempt web search BEFORE giving up — many Instagram posts
      // tease a recipe without including it in the caption.
      let webSearchResult: { ingredients: string[]; instructions: string[]; tags: string[]; mealType: string; keyIngredients: string[]; sourceUrl: string } | null = null
      
      const captionWasTruncated = extracted.truncated === true
      const aiSaidNotRecipe = parsed.title === 'Not a recipe'
      const hasNoRecipeData = parsed.ingredients.length === 0 && parsed.instructions.length === 0
      const looksIncomplete = parsed.ingredients.length > 0 && parsed.ingredients.length <= 3 && parsed.instructions.length === 0
      
      if (isInstagramUrl(targetUrl) && (aiSaidNotRecipe || captionWasTruncated || hasNoRecipeData || looksIncomplete)) {
        // When the AI couldn't extract a usable title (returned "Not a recipe"),
        // try to derive a search query from the raw caption text
        const searchTitle = aiSaidNotRecipe
          ? extractDishNameFromCaption(extracted.content)
          : parsed.title
        
        if (searchTitle) {
          setLoadingStep('websearch')
          webSearchResult = await searchWebForRecipe(searchTitle, extracted.author)
          
          // If AI said "Not a recipe" but web search found one, update the parsed title
          if (webSearchResult && aiSaidNotRecipe) {
            parsed.title = searchTitle
          }
        }
      }
      
      // Only throw "not a recipe" if we truly found nothing — AI said no AND web search failed
      if (aiSaidNotRecipe && !webSearchResult) {
        throw new Error('This page doesn\'t appear to contain a recipe')
      }
      
      // If the author is still Unknown but web search found a recipe,
      // try to derive the author from the source website domain
      let finalAuthor = extracted.author
      if (finalAuthor === 'Unknown' && webSearchResult?.sourceUrl) {
        try {
          const domain = new URL(webSearchResult.sourceUrl).hostname.replace('www.', '')
          // Use the domain name without TLD as the author (e.g., "cookingforpeanuts.com" → "cookingforpeanuts")
          const domainName = domain.split('.')[0]
          if (domainName && domainName.length > 2) {
            finalAuthor = domainName
          }
        } catch {
          // ignore
        }
      }
      
      setPreview({
        title: parsed.title,
        ingredients: webSearchResult?.ingredients || parsed.ingredients,
        instructions: webSearchResult?.instructions || parsed.instructions,
        tags: webSearchResult?.tags?.length ? webSearchResult.tags : parsed.tags,
        caption: extracted.content.slice(0, 2000), // Truncate for storage
        imageUrl: extracted.imageUrl,
        instagramUrl: extracted.sourceUrl,
        author: finalAuthor,
        recipeSourceUrl: webSearchResult?.sourceUrl || undefined,
        mealType: toMealType(webSearchResult?.mealType || parsed.mealType || 'other'),
        keyIngredients: webSearchResult?.keyIngredients?.length ? webSearchResult.keyIngredients : parsed.keyIngredients,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to extract recipe'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [url, extractFromInstagram, extractFromWebsite])
  
  const saveRecipe = useCallback(async () => {
    if (!preview) return

    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }
    
    const recipe: Recipe = {
      title: preview.title || 'Untitled Recipe',
      caption: preview.caption || '',
      ingredients: preview.ingredients || [],
      instructions: preview.instructions || [],
      imageUrl: preview.imageUrl || '',
      instagramUrl: preview.instagramUrl || '',
      author: preview.author || 'Unknown',
      savedAt: new Date().toISOString(),
      tags: preview.tags || [],
      starred: false,
      notes: '',
      recipeSourceUrl: preview.recipeSourceUrl || '',
      mealType: preview.mealType || 'other',
      keyIngredients: preview.keyIngredients || [],
    }

    setSavingRecipe(true)
    setError(null)
    try {
      // `create` used fire-and-forget `sendMessage`, which is a no-op if the
      // WebSocket is not open — the UI would navigate away and the recipe
      // never persisted. `createConfirmed` waits for a server ack.
      await createConfirmed(recipe)
      setPreview(null)
      setUrl('')
      toastSuccess('Recipe saved', 'Opening your recipe list…')
      navigate('/recipes')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save recipe'
      setError(message)
      toastError('Failed to save recipe', message)
    } finally {
      setSavingRecipe(false)
    }
  }, [preview, createConfirmed, navigate, recordStoreReady, toastError, toastSuccess])
  
  return (
    <div className="h-full bg-surface overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-5 gap-6">
          
          {/* Left Column - Main Form */}
          <div className="lg:col-span-3 space-y-5">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary-border/50">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-surface-elevated rounded-2xl flex items-center justify-center shadow-card flex-shrink-0">
                  <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-content">Add New Recipe</h1>
                  <p className="text-content-secondary text-sm mt-1">
                    Paste a recipe link from Instagram or any website
                  </p>
                </div>
              </div>
              
              {/* Input */}
              <div className="mt-5">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/... or any recipe URL"
                    className="flex-1 px-4 py-3 bg-surface-elevated border border-border rounded-xl text-content placeholder:text-content-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-muted transition-all text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && extractRecipe()}
                  />
                  <Button
                    onClick={extractRecipe}
                    disabled={loading || !url.trim()}
                    className="px-5"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {loadingStep === 'extract' ? 'Fetching...' : loadingStep === 'scrape' ? 'Scraping...' : loadingStep === 'websearch' ? 'Searching web...' : 'Parsing...'}
                      </span>
                    ) : 'Extract Recipe'}
                  </Button>
                </div>
                
                {error && (
                  <div className="mt-3 p-3 bg-danger-muted border border-danger-border rounded-xl text-danger text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
            
            {/* Preview Section */}
            {preview && (
              <div className="bg-surface-elevated rounded-2xl shadow-card border border-border overflow-hidden">
                <div className="p-4 bg-surface-overlay border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-content">Recipe Preview</h2>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveRecipe}
                      disabled={!recordStoreReady || savingRecipe}
                    >
                      {savingRecipe ? 'Saving…' : 'Save Recipe'}
                    </Button>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex gap-5">
                    {preview.imageUrl && (
                      <a
                        href={preview.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-28 h-28 flex-shrink-0 group rounded-xl overflow-hidden"
                      >
                        <img
                          src={preview.imageUrl}
                          alt={preview.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                            <circle cx="12" cy="12" r="3.5"/>
                          </svg>
                        </div>
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-content">{preview.title}</h3>
                      <p className="text-content-secondary text-sm">by @{preview.author}</p>
                      
                      {preview.tags && preview.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {preview.tags.slice(0, 4).map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-primary-muted text-primary text-xs rounded-full">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Meal Type Selector */}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-content-muted">Meal:</span>
                        <div className="flex gap-1 flex-wrap">
                          {MEAL_TYPE_OPTIONS.map((opt) => {
                            const isSelected = (preview.mealType || 'other') === opt.value
                            const selectedColorMap: Record<string, string> = {
                              warning: 'bg-warning/15 text-warning ring-1 ring-warning/30',
                              primary: 'bg-primary/15 text-primary ring-1 ring-primary/30',
                              danger: 'bg-danger/15 text-danger ring-1 ring-danger/30',
                              success: 'bg-success/15 text-success ring-1 ring-success/30',
                              muted: 'bg-surface-overlay text-content-secondary ring-1 ring-border',
                            }
                            const config = MEAL_TYPE_CONFIG[opt.value]
                            const activeClass = selectedColorMap[config.color] || selectedColorMap.muted
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setPreview(prev => prev ? { ...prev, mealType: opt.value } : prev)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
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
                      
                      <div className="flex gap-4 mt-3 text-sm text-content-muted">
                        <span>{preview.ingredients?.length || 0} ingredients</span>
                        <span>{preview.instructions?.length || 0} steps</span>
                      </div>
                      
                      {preview.recipeSourceUrl && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-info">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <span>Recipe found on </span>
                          <a
                            href={preview.recipeSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            {(() => {
                              try { return new URL(preview.recipeSourceUrl).hostname.replace('www.', '') } catch { return 'website' }
                            })()}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Debug Panel - Raw Instagram Data */}
            {debugInfo && (
              <div className="bg-surface-elevated rounded-2xl border border-border overflow-hidden">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors"
                >
                  <span className="text-sm font-medium text-content-secondary flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Debug: Raw Extraction Data
                  </span>
                  <svg className={`w-4 h-4 text-content-muted transition-transform ${showDebug ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showDebug && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Raw Caption */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-xs font-semibold text-content-muted uppercase tracking-wider">
                          Raw Caption from Instagram ({debugInfo.rawCaption.length} chars)
                        </h4>
                        {debugInfo.truncated && (
                          <span className="px-1.5 py-0.5 bg-warning-muted text-warning text-xs rounded font-medium">
                            TRUNCATED
                          </span>
                        )}
                      </div>
                      <pre className="text-xs text-content-secondary bg-surface-overlay rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto border border-border font-mono">
                        {debugInfo.rawCaption || '(empty)'}
                      </pre>
                    </div>
                    
                    {/* AI Parsed Result */}
                    <div>
                      <h4 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                        AI Parsed Result
                      </h4>
                      <pre className="text-xs text-content-secondary bg-surface-overlay rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto border border-border font-mono">
                        {JSON.stringify(debugInfo.aiParsed, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>
          
          {/* Right Column - Recent Recipes */}
          <div className="lg:col-span-2 space-y-5">
            {/* Recent Recipes */}
            <div className="bg-surface-elevated rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-content">Recent Recipes</h3>
                {recipes && recipes.length > 0 && (
                  <Link to="/recipes" className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                )}
              </div>
              
              {recentRecipes.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-surface-overlay rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-sm text-content-secondary">No recipes yet</p>
                  <p className="text-xs text-content-muted mt-1">Add your first one above!</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentRecipes.map((record) => (
                    <Link
                      key={record.recordId}
                      to={`/recipes/${record.recordId}`}
                      className="flex items-center gap-3 p-3 hover:bg-surface-overlay/50 transition-colors"
                    >
                      {record.data.imageUrl ? (
                        <img
                          src={record.data.imageUrl}
                          alt={record.data.title}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-surface-overlay flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-content truncate flex items-center gap-1">
                          {record.data.starred && <svg className="w-3.5 h-3.5 text-warning flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
                          <span className="truncate">{record.data.title}</span>
                        </p>
                        <p className="text-xs text-content-muted">@{record.data.author}</p>
                      </div>
                      <svg className="w-4 h-4 text-content-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
