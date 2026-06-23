/**
 * Instagram post extraction — server-side only.
 *
 * Ported from the original HyperFoodie backend `InstagramService`. DeepSpace
 * has no Instagram integration, and Instagram blocks anonymous *browser*
 * requests (login wall) — but it still serves Open Graph preview tags to known
 * crawler user-agents (facebookexternalhit / Googlebot). So we fetch the public
 * post page from the worker (no CORS limit) with a crawler UA and parse the
 * caption, author, and image out of the embedded JSON / OG meta tags.
 *
 * Instagram's responses vary per request (sometimes og:description is empty),
 * so we retry across a few crawler UAs until we get usable data.
 *
 * The caption Instagram exposes to crawlers is usually truncated; the caller
 * (RecipeHomeView) treats a short caption as "truncated" and falls back to a
 * web search for the full recipe — exactly as the original app did.
 */

export interface InstagramPost {
  caption: string
  imageUrl: string
  author: string
  permalink: string
}

const CRAWLER_USER_AGENTS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'facebookexternalhit/1.1',
]

/** Decode the HTML entities Instagram emits in OG tags (&quot;, &amp;, &#x..;, &#..;). */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2019;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)) } catch { return _m }
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)) } catch { return _m }
    })
}

/** Validate the URL is an Instagram post/reel/tv and return its shortcode. */
export function parseInstagramShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/p\/([^/?#]+)/,
    /instagram\.com\/reel\/([^/?#]+)/,
    /instagram\.com\/reels\/([^/?#]+)/,
    /instagram\.com\/tv\/([^/?#]+)/,
    /instagram\.com\/[^/]+\/(?:p|reel|reels|tv)\/([^/?#]+)/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

function metaContent(html: string, property: string): string {
  // Match both attribute orders: property-then-content and content-then-property.
  const a = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
  )
  if (a?.[1]) return a[1]
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
  )
  return b?.[1] ?? ''
}

/**
 * Pull the full caption from Instagram's embedded `xdt_api` JSON when present.
 * Crawler responses usually omit this, but try it first — it carries the
 * complete caption rather than the ~200-char OG snippet.
 */
function extractFromXdtApi(html: string): { caption: string; username: string } | null {
  const idx = html.indexOf('xdt_api__v1__')
  if (idx < 0) return null
  const start = html.lastIndexOf('<script', idx)
  const end = html.indexOf('</script>', idx)
  if (start < 0 || end < 0) return null
  const json = html.slice(html.indexOf('{', start), end)

  const captionMatch = json.match(/"caption":\{"text":"((?:[^"\\]|\\.)*)"/)
  if (!captionMatch) return null

  const caption = captionMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => {
      const code = parseInt(hex, 16)
      return code >= 0xd800 && code <= 0xdfff ? '' : String.fromCharCode(code)
    })
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')

  const userMatch = json.match(/"user":\{"id":"[^"]*","username":"([^"]*)"/)
  return { caption, username: userMatch?.[1] ?? '' }
}

/**
 * Parse the OG `description` tag, which Instagram formats as:
 *   "12K likes, 34 comments - username on April 24, 2026: "the caption…""
 * Returns the caption (without the stats prefix) and the username.
 */
function parseOgDescription(raw: string): { caption: string; username: string } {
  let username = ''
  const userMatch = raw.match(/-\s*([\w.]+)\s+on\b/)
  if (userMatch) username = userMatch[1]

  let caption = raw
  const captionMatch = raw.match(/:\s*&quot;([\s\S]*)&quot;\s*$/) || raw.match(/:\s*"([\s\S]*)"\s*$/)
  if (captionMatch) caption = captionMatch[1]

  return { caption: decodeHtmlEntities(caption).trim(), username }
}

async function fetchPostHtml(url: string): Promise<string | null> {
  let fallback: string | null = null
  for (const ua of CRAWLER_USER_AGENTS) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })
      if (!res.ok) continue
      const html = await res.text()
      // Prefer a response that actually carries caption data.
      if (/og:description"\s+content="[^"]+/.test(html) || html.includes('xdt_api__v1__')) {
        return html
      }
      fallback ??= html
    } catch {
      // Try the next user-agent.
    }
  }
  return fallback
}

/**
 * Fetch an Instagram post and extract its caption, author, and image.
 * Throws a user-facing error when the post can't be read.
 */
export async function extractInstagramPost(url: string): Promise<InstagramPost> {
  if (!parseInstagramShortcode(url)) {
    throw new Error('That doesn’t look like an Instagram post, reel, or TV link.')
  }

  const html = await fetchPostHtml(url)
  if (!html) {
    throw new Error('Could not reach this Instagram post. It may be private or removed.')
  }

  // 1) Full caption from embedded JSON when available.
  const xdt = extractFromXdtApi(html)

  // 2) OG tags (the reliable path for crawler requests).
  const ogDescription = metaContent(html, 'og:description')
  const ogTitle = metaContent(html, 'og:title')
  const ogImage = decodeHtmlEntities(metaContent(html, 'og:image'))

  const fromOg = ogDescription ? parseOgDescription(ogDescription) : { caption: '', username: '' }

  // Last resort: the quoted caption fragment inside og:title
  // ("Author on Instagram: "caption…"").
  let titleCaption = ''
  const titleMatch = ogTitle.match(/:\s*&quot;([\s\S]*?)&quot;/) || ogTitle.match(/:\s*"([\s\S]*?)"/)
  if (titleMatch) titleCaption = decodeHtmlEntities(titleMatch[1]).trim()

  const caption = xdt?.caption || fromOg.caption || titleCaption
  if (!caption) {
    throw new Error(
      'Instagram didn’t return this post’s caption (it may be private, age-restricted, ' +
        'or rate-limited). Try the recipe’s website link instead.',
    )
  }

  const author =
    xdt?.username ||
    fromOg.username ||
    parseInstagramUsernameFromUrl(url) ||
    ''

  return {
    caption,
    imageUrl: ogImage,
    author,
    permalink: url,
  }
}

/** instagram.com/<username>/p/<code> → username (when present in the URL). */
function parseInstagramUsernameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const m = path.match(/^\/([^/]+)\/(?:p|reel|reels|tv)\//)
    const reserved = ['p', 'reel', 'reels', 'tv', 'stories', 'explore']
    if (m && !reserved.includes(m[1].toLowerCase())) return m[1]
  } catch {
    // ignore
  }
  return ''
}
