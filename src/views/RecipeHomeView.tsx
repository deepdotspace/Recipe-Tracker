/**
 * Home Page - Extract Recipes from Instagram or any website
 */

import { useState, useCallback } from 'react'
import { useMutations, useRecordContext, integration, useAuth, AuthOverlay } from 'deepspace'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/ui'
import { MEAL_TYPE_OPTIONS, MEAL_ACCENT, type MealType } from '../constants'
import { usePlanGate } from '../hooks/usePlanGate'
import { Check, Loader2, ExternalLink, Globe } from 'lucide-react'

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
  calories?: number
  protein?: number
  servings?: number
}

/** OpenAI chat completion — api-worker returns handler output inside `data` */
type OpenAIChatCompletionData = {
  choices: Array<{ message: { content: string } }>
}

type FirecrawlSearchIntegrationData = {
  data: Array<{ markdown?: string; url?: string }>
}

type FirecrawlScrapeIntegrationData = {
  data: {
    markdown?: string
    metadata?: {
      title?: string
      description?: string
      ogTitle?: string
      ogDescription?: string
      ogImage?: string
    }
  }
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
  "keyIngredients": ["ingredient1", "ingredient2", "ingredient3"],
  "servings": 4,
  "calories": 520,
  "protein": 34
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
- Nutrition estimation (servings, calories, protein): estimate how many servings the recipe makes, then estimate APPROXIMATE calories (kcal) and protein (grams) PER SERVING from the ingredient list and amounts. Use standard nutrition knowledge (e.g., 6 oz chicken breast ≈ 280 kcal / 52g protein). Round to whole numbers. Be realistic, not optimistic. If ingredients or amounts are missing so no reasonable estimate is possible, use null for calories and protein.
- ONLY return {"title": "Not a recipe", "ingredients": [], "instructions": [], "tags": [], "mealType": "other"} if the content has absolutely nothing to do with food or cooking.
- Always return valid JSON, nothing else`

function isInstagramUrl(url: string): boolean {
  return url.includes('instagram.com') || url.includes('instagr.am')
}

// Social platforms whose posts usually tease a recipe without including the
// full ingredient list — for these, an incomplete parse falls back to a web
// search for the complete recipe (same flow Instagram has always used).
const SOCIAL_HOSTS = [
  'instagram.com', 'instagr.am',
  'twitter.com', 'x.com', 't.co',
  'youtube.com', 'youtu.be',
]

function isSocialUrl(url: string): boolean {
  return SOCIAL_HOSTS.some((host) => url.includes(host))
}

// Platforms our scrapers verifiably cannot read (login walls block Firecrawl
// and Exa). Fail fast with a helpful message instead of burning a scrape
// call that will error anyway. Re-test before removing a host from this list.
const UNSUPPORTED_HOSTS: Array<{ host: string; label: string }> = [
  { host: 'tiktok.com', label: 'TikTok' },
  { host: 'vm.tiktok.com', label: 'TikTok' },
  { host: 'reddit.com', label: 'Reddit' },
  { host: 'redd.it', label: 'Reddit' },
  { host: 'facebook.com', label: 'Facebook' },
  { host: 'fb.watch', label: 'Facebook' },
]

function unsupportedHostLabel(url: string): string | null {
  return UNSUPPORTED_HOSTS.find(({ host }) => url.includes(host))?.label ?? null
}

// Extract a YouTube video id from watch/short/embed/youtu.be URL shapes.
function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace('www.', '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const pathMatch = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/)
      if (pathMatch) return pathMatch[2]
    }
  } catch {
    // fall through
  }
  return null
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

/** Coerce an AI-returned nutrition value into a sane positive integer, else undefined. */
function toNutritionInt(value: unknown, max: number): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined
  return Math.min(Math.round(n), max)
}

interface ParsedRecipe {
  title: string
  ingredients: string[]
  instructions: string[]
  tags: string[]
  mealType: string
  keyIngredients: string[]
  calories?: number
  protein?: number
  servings?: number
}

async function parseRecipeWithAI(caption: string): Promise<ParsedRecipe> {
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
      calories: toNutritionInt(parsed.calories, 5000),
      protein: toNutritionInt(parsed.protein, 500),
      servings: toNutritionInt(parsed.servings, 100),
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

/** Apify run-actor kickoff + get-run polling envelopes. */
type ApifyRunStartData = { jobId?: string; status?: string; datasetId?: string }
type ApifyRunPollData = {
  status?: string
  items?: Array<{ data?: Array<{ start?: string; dur?: string; text?: string }> }>
}

// Transcript segments a video can produce is unbounded; cap what we hand the
// AI parser so a long video doesn't blow the token budget.
const TRANSCRIPT_CHAR_LIMIT = 16000

// Fetch a YouTube video transcript through the Apify transcript actor.
// run-actor returns a jobId immediately; get-run (free) is polled until the
// dataset with the caption segments is ready (~10-30s).
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const startResponse = await integration.post<ApifyRunStartData>('apify/run-actor', {
    actorId: 'pintostudio/youtube-transcript-scraper',
    input: { videoUrl: `https://www.youtube.com/watch?v=${videoId}` },
    maxTotalChargeUsd: 0.1,
    timeout: 90,
  })

  const runId = startResponse.data?.jobId
  if (!startResponse.success || !runId) {
    throw new Error(startResponse.error || 'Could not start the transcript fetch')
  }

  const deadline = Date.now() + 75_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000))
    const poll = await integration.post<ApifyRunPollData>('apify/get-run', { runId, offset: 0 })
    const status = poll.data?.status
    if (status === 'SUCCEEDED') {
      const segments = poll.data?.items?.[0]?.data
      const text = (segments ?? [])
        .map((s) => s.text?.trim())
        .filter(Boolean)
        .join(' ')
      if (!text) {
        throw new Error('This video has no captions to read a recipe from')
      }
      return text.slice(0, TRANSCRIPT_CHAR_LIMIT)
    }
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error('Could not read this video’s captions')
    }
  }
  throw new Error('Timed out reading the video’s captions — try again')
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
type WebSearchRecipe = Omit<ParsedRecipe, 'title'> & { sourceUrl: string }

async function trySearchQuery(query: string): Promise<WebSearchRecipe | null> {
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
          calories: parsed.calories,
          protein: parsed.protein,
          servings: parsed.servings,
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
): Promise<WebSearchRecipe | null> {
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
  // The landing hero forwards a pasted link as /add?url=… — read it once on
  // mount to prefill the input. We deliberately do NOT auto-extract: extraction
  // costs money and may require sign-in.
  const [searchParams] = useSearchParams()
  const [url, setUrl] = useState(() => searchParams.get('url') ?? '')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<'extract' | 'scrape' | 'transcript' | 'parse' | 'websearch'>('extract')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Partial<Recipe> | null>(null)
  const [savingRecipe, setSavingRecipe] = useState(false)

  const { ready: recordStoreReady } = useRecordContext()
  const { success: toastSuccess, error: toastError } = useToast()
  const { isSignedIn } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  const { createConfirmed } = useMutations('recipes')
  const { create: logExtraction } = useMutations('extractionLog')
  const planGate = usePlanGate()

  const extractFromInstagram = useCallback(async (targetUrl: string) => {
    setLoadingStep('extract')

    // DeepSpace has no Instagram integration, so the app's own worker fetches
    // the public post server-side (crawler UA) and parses the OG tags — the
    // same logic as the original HyperFoodie backend service. The caption is
    // usually truncated, which trips the web-search fallback below for the
    // full recipe — exactly as the original app worked.
    const response = await fetch('/api/instagram/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
    })

    const result = (await response.json().catch(() => ({}))) as {
      caption?: string
      imageUrl?: string
      author?: string
      permalink?: string
      error?: string
    }

    if (!response.ok || !result.caption) {
      throw new Error(result.error || 'Failed to extract content from Instagram')
    }

    // Author: API value first, then the URL, then caption @mentions.
    const authorName =
      result.author ||
      extractUsernameFromUrl(result.permalink || targetUrl) ||
      extractUsernameFromUrl(targetUrl) ||
      extractAuthorFromCaption(result.caption) ||
      'Unknown'

    return {
      content: result.caption,
      imageUrl: result.imageUrl || '',
      sourceUrl: result.permalink || targetUrl,
      author: authorName,
      truncated: isCaptionTruncated(result.caption),
    }
  }, [])
  
  const extractFromYouTube = useCallback(async (targetUrl: string, videoId: string) => {
    setLoadingStep('transcript')

    const transcript = await fetchYouTubeTranscript(videoId)

    return {
      content: transcript,
      // YouTube thumbnails are deterministic per video id — no API needed.
      imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      sourceUrl: targetUrl,
      author: 'youtube',
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

    const targetUrl = url.trim()

    // Platforms we can't read get a clear answer up front — before the
    // sign-in prompt, since no sign-in will make the link readable.
    const unsupported = unsupportedHostLabel(targetUrl)
    if (unsupported) {
      setError(
        `${unsupported} links can't be read yet — the platform blocks recipe extraction. ` +
        'If the creator shared the same recipe on Instagram, YouTube, or a blog, paste that link instead.',
      )
      return
    }

    // Extraction burns integration calls (scrape + AI parse), so it's
    // sign-in-only — anonymous visitors get the auth overlay instead.
    if (!isSignedIn) {
      setShowAuthModal(true)
      return
    }

    // Plan gates: YouTube extraction is paid-only; every plan has a monthly
    // extraction quota (see src/plan-limits.ts).
    const youTubeVideoId = getYouTubeVideoId(targetUrl)
    if (youTubeVideoId && !planGate.canUseYouTube) {
      planGate.promptUpgrade('youtube')
      return
    }
    if (!planGate.canExtract) {
      planGate.promptUpgrade('extractions')
      return
    }

    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      let extracted: { content: string; imageUrl: string; sourceUrl: string; author: string; title?: string; truncated?: boolean }

      if (isInstagramUrl(targetUrl)) {
        // extractFromInstagram already scrapes the post via Firecrawl; a
        // truncated caption flows into the web-search fallback below.
        extracted = await extractFromInstagram(targetUrl)
      } else if (youTubeVideoId) {
        // Firecrawl can't scrape YouTube (login-walled), but the spoken
        // transcript usually contains the full recipe.
        extracted = await extractFromYouTube(targetUrl, youTubeVideoId)
      } else {
        extracted = await extractFromWebsite(targetUrl)
      }
      
      setLoadingStep('parse')
      const parsed = await parseRecipeWithAI(extracted.content)

      // If the caption was truncated by Instagram or the parsed data looks incomplete,
      // search the web for the full recipe (e.g., from the author's blog).
      // This is critical because the Instagram API often returns only a short snippet
      // of the full caption, cutting off ingredient lists and instructions.
      // For Instagram, we attempt web search BEFORE giving up — many Instagram posts
      // tease a recipe without including it in the caption.
      let webSearchResult: WebSearchRecipe | null = null
      
      const captionWasTruncated = extracted.truncated === true
      const aiSaidNotRecipe = parsed.title === 'Not a recipe'
      const hasNoRecipeData = parsed.ingredients.length === 0 && parsed.instructions.length === 0
      const looksIncomplete = parsed.ingredients.length > 0 && parsed.ingredients.length <= 3 && parsed.instructions.length === 0
      
      if (isSocialUrl(targetUrl) && (aiSaidNotRecipe || captionWasTruncated || hasNoRecipeData || looksIncomplete)) {
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
      
      const finalIngredients = webSearchResult?.ingredients || parsed.ingredients
      const finalInstructions = webSearchResult?.instructions || parsed.instructions

      setPreview({
        title: parsed.title,
        ingredients: finalIngredients,
        instructions: finalInstructions,
        tags: webSearchResult?.tags?.length ? webSearchResult.tags : parsed.tags,
        caption: extracted.content.slice(0, 2000), // Truncate for storage
        imageUrl: extracted.imageUrl,
        instagramUrl: extracted.sourceUrl,
        author: finalAuthor,
        recipeSourceUrl: webSearchResult?.sourceUrl || undefined,
        mealType: toMealType(webSearchResult?.mealType || parsed.mealType || 'other'),
        keyIngredients: webSearchResult?.keyIngredients?.length ? webSearchResult.keyIngredients : parsed.keyIngredients,
        calories: webSearchResult?.calories ?? parsed.calories,
        protein: webSearchResult?.protein ?? parsed.protein,
        servings: webSearchResult?.servings ?? parsed.servings,
      })

      // Meter the extraction against the monthly plan quota — but only when
      // it actually produced recipe content. Failures throw before this line,
      // and a silently-degraded parse (AI call failed → title-only stub with
      // no ingredients or steps) shouldn't burn the user's quota either.
      if (finalIngredients.length > 0 || finalInstructions.length > 0) {
        logExtraction({ at: new Date().toISOString(), sourceUrl: extracted.sourceUrl })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to extract recipe'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [url, isSignedIn, planGate, logExtraction, extractFromInstagram, extractFromYouTube, extractFromWebsite])
  
  const saveRecipe = useCallback(async () => {
    if (!preview) return

    if (!isSignedIn) {
      setShowAuthModal(true)
      return
    }

    if (!recordStoreReady) {
      toastError('Not connected', 'Wait for the app to finish loading, then try again.')
      return
    }

    if (!planGate.canSave) {
      planGate.promptUpgrade('saves')
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
      calories: preview.calories,
      protein: preview.protein,
      servings: preview.servings,
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
  }, [preview, createConfirmed, navigate, isSignedIn, recordStoreReady, planGate, toastError, toastSuccess])
  
  const stepLabel =
    loadingStep === 'extract' ? 'Fetching…'
    : loadingStep === 'scrape' ? 'Scraping…'
    : loadingStep === 'transcript' ? 'Reading video…'
    : loadingStep === 'websearch' ? 'Searching web…'
    : 'Parsing…'

  const sourceDomain = preview?.recipeSourceUrl
    ? (() => {
        try { return new URL(preview.recipeSourceUrl).hostname.replace('www.', '') } catch { return 'website' }
      })()
    : ''

  return (
    <div className="min-h-full">
      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
      {planGate.upgradeModal}
      <div className="max-w-[720px] mx-auto px-[28px] pt-[56px] pb-[72px]">

        {/* Header */}
        <div className="text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary-deep">
            Add to your cookbook
          </p>
          <h1 className="mt-3 text-[40px] font-extrabold tracking-[-0.03em] leading-[1.05] text-ink">
            Save a recipe from anywhere
          </h1>
          <p className="mt-4 mx-auto max-w-[44ch] text-[16px] leading-[1.55] text-body-soft">
            Paste a link from Instagram, YouTube, a food blog, or any recipe site — Recipe Box
            pulls out the ingredients and steps into one clean, saveable card.
          </p>
        </div>

        {/* URL row */}
        <div className="mt-9">
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/p/… or any recipe URL"
              className="h-[52px] flex-1 min-w-0 rounded-[14px] bg-surface-soft border border-input px-4 text-[15px] text-ink placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-150"
              onKeyDown={(e) => e.key === 'Enter' && extractRecipe()}
            />
            <button
              onClick={extractRecipe}
              disabled={loading || !url.trim()}
              className="h-[52px] shrink-0 flex items-center gap-2 rounded-[14px] bg-primary px-6 text-[15px] font-bold text-primary-foreground shadow-[0_10px_20px_-8px_rgba(226,87,11,0.7)] transition-[background-color,box-shadow,opacity] duration-150 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {stepLabel}
                </>
              ) : (
                'Extract'
              )}
            </button>
          </div>

          {/* Supported sources */}
          <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-muted-2">
            <Check className="w-4 h-4 shrink-0 text-success" strokeWidth={2.5} />
            <span>Works with Instagram · YouTube · NYT Cooking · personal blogs</span>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mt-4 rounded-[14px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-10">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-2">
              Preview
            </p>
            <div className="mt-3 overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)]">
              {/* Top region */}
              <div className="flex gap-5 p-[22px]">
                {/* Photo tile */}
                <a
                  href={preview.instagramUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative h-[130px] w-[130px] shrink-0 overflow-hidden rounded-[14px] bg-photo-tile"
                >
                  {preview.imageUrl ? (
                    <img
                      src={preview.imageUrl}
                      alt={preview.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-faint">
                      <ExternalLink className="h-6 w-6" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors duration-150 group-hover:bg-ink/25">
                    <ExternalLink className="h-6 w-6 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                  </div>
                </a>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  {/* Meal type selector */}
                  <div className="flex flex-wrap gap-1.5">
                    {MEAL_TYPE_OPTIONS.map((opt) => {
                      const isSelected = (preview.mealType || 'other') === opt.value
                      const accent = MEAL_ACCENT[opt.value]
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setPreview((prev) => (prev ? { ...prev, mealType: opt.value } : prev))}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150 ${
                            isSelected ? 'bg-cream' : 'text-muted-2 hover:text-body-soft'
                          }`}
                          style={isSelected ? { color: accent } : undefined}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: isSelected ? accent : 'currentColor' }}
                          />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  <h3 className="mt-2.5 text-[22px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink">
                    {preview.title}
                  </h3>
                  <p className="mt-1 text-[13.5px] text-muted-2">by @{preview.author}</p>

                  {preview.tags && preview.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {preview.tags.slice(0, 4).map((tag, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-tag px-2 py-0.5 text-[11.5px] font-semibold capitalize text-[#8a6a4a]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {preview.recipeSourceUrl && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-primary-deep">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span>Recipe found on</span>
                      <a
                        href={preview.recipeSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold hover:underline"
                      >
                        {sourceDomain}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer bar */}
              <div className="flex items-center justify-between gap-4 border-t border-border bg-surface-soft p-4">
                <div className="text-[13px] text-muted-2">
                  {preview.ingredients?.length || 0} ingredients · {preview.instructions?.length || 0} steps
                  {preview.calories != null && (
                    <>
                      {' '}· ≈{preview.calories} kcal
                      {preview.protein != null && ` · ${preview.protein}g protein`} / serving
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setPreview(null)}
                    className="h-9 rounded-[12px] border border-input bg-card px-3.5 text-[13.5px] font-semibold text-body-soft transition-colors duration-150 hover:bg-surface-soft"
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveRecipe}
                    disabled={savingRecipe || (isSignedIn && !recordStoreReady)}
                    className="h-9 rounded-[12px] bg-ink px-4 text-[13.5px] font-semibold text-[#fdf6ec] transition-colors duration-150 hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ink"
                  >
                    {savingRecipe ? 'Saving…' : isSignedIn ? 'Save to cookbook' : 'Sign in to Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
