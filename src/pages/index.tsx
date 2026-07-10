/**
 * Landing page — the public front door at `/`.
 *
 * Design recreated from `design_handoff_recipe_box` (README › "1. Landing" +
 * "Global chrome › Marketing header" + Design Tokens). Warm editorial
 * "cookbook" aesthetic: cream page, one orange accent, soft shadows — no
 * glassmorphism, no gradient blooms (the CTA-band corner glow is the one
 * sanctioned glow).
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, AuthOverlay } from 'deepspace'
import { ChefHat, Link2, Tag, ShoppingCart, Check, ArrowRight } from 'lucide-react'
import { APP_DISPLAY_NAME, MEAL_ACCENT, type MealType } from '../constants'
import { POPULAR_RECIPES } from '../data/popular-recipes'

const byId = (id: string) => POPULAR_RECIPES.find((r) => r.id === id)!
const HERO_LARGE = byId('steak-frites').imageUrl
const HERO_SMALL = byId('berry-ricotta-toast').imageUrl
// A varied trio for the cookbook preview — one dinner, one breakfast, one comfort classic.
const PREVIEW_RECIPES = [
  byId('steak-frites'),
  byId('berry-kiwi-overnight-oats'),
  byId('double-smash-burger'),
]

const WORKS_WITH = 'Works with Instagram · YouTube · NYT Cooking · personal blogs'

const FEATURES: Array<{ icon: typeof Link2; title: string; body: string }> = [
  {
    icon: Link2,
    title: 'Save from anywhere',
    body: 'Instagram reels, YouTube videos, food blogs — paste a link and the full recipe lands in your box.',
  },
  {
    icon: Tag,
    title: 'Organized for you',
    body: 'Every recipe is auto-tagged by meal and key ingredients, so the right dish is always a search away.',
  },
  {
    icon: ShoppingCart,
    title: 'Shop in one tap',
    body: 'Turn any recipe into a grocery list instantly — grouped by dish, checked off as you go.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-full bg-background text-body">
      <MarketingHeader />
      <main className="mx-auto max-w-[1160px] px-7 max-sm:px-5">
        <Hero />
        <Features />
        <Preview />
        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}

/* ── Marketing header ─────────────────────────────────────────────────── */

function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_14px_-4px_rgba(226,87,11,0.6)]">
        <ChefHat className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="text-[20px] font-extrabold tracking-[-0.02em] text-ink">
        {APP_DISPLAY_NAME}
      </span>
    </Link>
  )
}

function MarketingHeader() {
  const { isSignedIn } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-[12px]">
      <nav className="mx-auto flex h-[66px] max-w-[1160px] items-center justify-between gap-4 px-7 max-sm:px-5">
        <Brand />
        <div className="flex items-center gap-6 max-sm:gap-4">
          <a
            href="#features"
            className="hidden text-sm font-semibold text-body-soft transition-colors duration-150 hover:text-ink sm:block"
          >
            How it works
          </a>
          <Link
            to="/discover"
            className="hidden text-sm font-semibold text-body-soft transition-colors duration-150 hover:text-ink sm:block"
          >
            Browse recipes
          </Link>
          {isSignedIn ? (
            <Link
              to="/recipes"
              className="hidden text-sm font-semibold text-body-soft transition-colors duration-150 hover:text-ink sm:block"
            >
              Open cookbook
            </Link>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="hidden text-sm font-semibold text-body-soft transition-colors duration-150 hover:text-ink sm:block"
            >
              Sign in
            </button>
          )}
          <Link
            to="/recipes"
            className="flex h-[42px] items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_12px_24px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep"
          >
            Get started
          </Link>
        </div>
      </nav>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </header>
  )
}

/* ── Hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')

  const save = () => {
    const value = url.trim()
    navigate(value ? `/add?url=${encodeURIComponent(value)}` : '/add')
  }

  return (
    <section className="grid items-center gap-14 pb-10 pt-[60px] max-lg:grid-cols-1 max-lg:gap-10 lg:grid-cols-2">
      {/* Left column */}
      <div>
        <span className="inline-flex items-center rounded-full bg-cream px-3.5 py-1.5 text-xs font-bold text-primary-deep">
          Save · Organize · Shop
        </span>
        <h1 className="mt-5 text-[54px] font-extrabold leading-[1.03] tracking-[-0.035em] text-ink max-lg:text-4xl">
          Every recipe you love, in one tidy place.
        </h1>
        <p className="mt-5 max-w-[46ch] text-[17px] leading-[1.55] text-body-soft">
          Paste a link from Instagram, a food blog, or anywhere on the web.
          Recipe Box pulls out the ingredients and steps into one clean,
          searchable cookbook — then builds your grocery list in a tap.
        </p>

        <div className="mt-8 flex gap-3 max-sm:flex-col">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
            placeholder="Paste a recipe link…"
            className="h-[52px] flex-1 rounded-[14px] border border-input bg-surface-soft px-4 text-[15px] text-body placeholder:text-muted-2 focus:border-primary focus:outline-none"
          />
          <button
            onClick={save}
            className="flex h-[52px] shrink-0 items-center justify-center rounded-[14px] bg-primary px-6 text-[15px] font-bold text-primary-foreground shadow-[0_12px_24px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep"
          >
            Save a recipe
          </button>
        </div>

        <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-2">
          <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
          {WORKS_WITH}
        </p>
      </div>

      {/* Right column — photo collage */}
      <div className="relative mx-auto h-[460px] w-full max-w-[420px] max-lg:h-[420px]">
        <img
          src={HERO_LARGE}
          alt=""
          className="absolute right-0 top-0 h-[380px] w-[320px] rounded-3xl object-cover shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)] max-sm:w-[280px]"
        />
        <div className="absolute bottom-0 left-0 rounded-[20px] bg-background p-1 shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]">
          <img
            src={HERO_SMALL}
            alt=""
            className="h-[240px] w-[226px] rounded-[16px] object-cover max-sm:h-[200px] max-sm:w-[180px]"
          />
        </div>
        <div className="absolute left-2 top-[46%] flex items-center gap-3 rounded-2xl bg-card p-3 pr-4 shadow-[0_2px_8px_rgba(61,35,20,0.15)]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
            <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <span className="text-[13px] font-semibold leading-tight text-ink">
            12 ingredients added
            <br />
            <span className="font-normal text-muted-foreground">to your grocery list</span>
          </span>
        </div>
      </div>
    </section>
  )
}

/* ── Features ─────────────────────────────────────────────────────────── */

function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-16">
      <div className="grid gap-[22px] max-md:grid-cols-1 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-[20px] border border-border bg-surface-soft p-[26px] shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)] transition-transform duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]"
          >
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-cream text-primary">
              <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
            </span>
            <h3 className="mt-4 text-[18px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-[1.55] text-body-soft">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Preview ──────────────────────────────────────────────────────────── */

function MealChip({ mealType }: { mealType: MealType }) {
  const color = MEAL_ACCENT[mealType]
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold capitalize" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {mealType}
    </span>
  )
}

function Preview() {
  return (
    <section className="py-16">
      <div className="text-center">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary-deep">
          Your Cookbook
        </span>
        <h2 className="mt-3 text-[34px] font-extrabold tracking-[-0.03em] text-ink">
          Beautifully kept, always searchable
        </h2>
      </div>

      <div className="mt-10 grid gap-[22px] max-lg:grid-cols-2 max-sm:grid-cols-1 lg:grid-cols-3">
        {PREVIEW_RECIPES.map((recipe) => (
          <Link
            key={recipe.id}
            to="/discover"
            className="group block overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_12px_26px_-18px_rgba(61,35,20,0.4)] transition-transform duration-150 ease-out hover:-translate-y-1 hover:shadow-[0_22px_44px_-24px_rgba(61,35,20,0.55)]"
          >
            <div className="h-[168px] bg-photo-tile">
              <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="p-4">
              <MealChip mealType={recipe.mealType} />
              <h3 className="mt-2 text-[17px] font-bold leading-[1.25] tracking-[-0.015em] text-ink">
                {recipe.title}
              </h3>
              <p className="mt-1 text-[13px] text-muted-2">from the Recipe Box kitchen</p>
              <p className="mt-3 text-[12.5px] text-muted-2">
                {recipe.ingredients.length} ingredients · {recipe.instructions.length} steps
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ── CTA band ─────────────────────────────────────────────────────────── */

function CtaBand() {
  return (
    <section className="py-16">
      <div className="relative overflow-hidden rounded-[28px] bg-ink px-8 py-14 text-center max-sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-[44ch]">
          <h2 className="text-[36px] font-extrabold tracking-[-0.03em] text-background max-sm:text-3xl">
            Start your cookbook today
          </h2>
          <p className="mt-4 text-[16px] leading-[1.55] text-background/75">
            Save the recipes you already love, organize them in seconds, and never
            lose a good dinner to a buried screenshot again.
          </p>
          <Link
            to="/recipes"
            className="mt-8 inline-flex h-[52px] items-center gap-2 rounded-[14px] bg-primary px-7 text-[15px] font-bold text-primary-foreground shadow-[0_12px_24px_-8px_rgba(226,87,11,0.7)] transition-colors duration-150 hover:bg-primary-deep"
          >
            Get started free
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Footer ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-4 px-7 py-8 max-sm:flex-col max-sm:items-start max-sm:gap-4 max-sm:px-5">
        <Brand />
        <nav className="flex items-center gap-6 text-[13.5px] text-muted-foreground">
          <a href="#" className="transition-colors duration-150 hover:text-ink">About</a>
          <a href="#" className="transition-colors duration-150 hover:text-ink">Privacy</a>
          <a href="#" className="transition-colors duration-150 hover:text-ink">Help</a>
        </nav>
        <p className="text-[13.5px] text-muted-foreground">© 2026 Recipe Box</p>
      </div>
    </footer>
  )
}
