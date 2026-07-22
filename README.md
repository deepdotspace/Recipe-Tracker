# Recipe Tracker

Save any recipe from Instagram or the web, then cook from a clean collection
with a pantry and grocery list built in. Built on the
[DeepSpace SDK](https://deep.space).

**Live app:** https://recipe-tracker.app.space

## What it does
- Paste an Instagram post or any recipe URL and get back a structured recipe — title, ingredients, step-by-step instructions, servings, and nutrition.
- Keep a searchable, starrable collection of everything you've saved, plus a discover feed of popular recipes.
- Track what's in your pantry and build a grocery list with checkable items.
- Paid tiers raise your monthly extraction quota and saved-recipe limits.

## How it's built
Recipes, pantry items, and grocery lists are stored as collections in a
`RecordRoom` Durable Object. Extraction chains several services through the
DeepSpace integrations proxy — Apify to pull Instagram posts, Firecrawl to
search and scrape web pages, and an OpenAI chat-completion call to parse the raw
content into a structured recipe — while the app's own worker fetches Instagram
Open Graph tags where no integration exists. Free/Plus/Pro/Chef plans are
defined as Stripe-synced subscriptions and enforced with `useSubscription` plan
gating; one-time unlocks use `useCheckout`, and heavier work can be handed off
to background jobs.

## Run your own

Deploy your own copy in three commands:

```sh
npm install
npx deepspace login     # one-time, opens a browser tab
npx deepspace deploy    # -> <name>.app.space
```

Auth, the database, real-time sync, and hosting all come from DeepSpace, so
there is nothing else to configure. Your subdomain is the `name` field in
`wrangler.toml`; change it for your own deployment.

Or build something new: apps like this are made by handing a prompt to a
coding agent — start at [deep.space/get-started](https://deep.space/get-started),
or scaffold from scratch: `npm create deepspace@latest my-app`.

---
*Recipe Tracker was built end-to-end by an AI agent on the DeepSpace SDK.
DeepSpace is laying the foundation for rebuilding the Internet in an AI-native
way — [deep.space](https://deep.space) · [docs](https://docs.deep.space).*
