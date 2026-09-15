# Import: Genie Buddy AI (from GitHub)

## What this app is

"Genie Buddy AI" — an AI content studio: you connect sources, generate ideas and scripts, and schedule AI-produced videos for channels. Signed-in users get a workspace with Chat, Sources, Channels, and Studio pages, plus a scheduled job that prepares due videos on a timer.

Good news: the repository was itself built with Lovable and uses the same technology as this project, so the code ports over almost directly.

## Steps

1. **Copy the app code** from the cloned repo into this project:
   - Pages: landing redirect, sign-in page, and the signed-in workspace (Chat, Sources, Channels, Studio)
   - All UI building blocks (components), helpers, and styling (`src/components`, `src/lib`, `src/hooks`, `src/styles.css`, `src/integrations`)
   - Server config (`src/start.ts`, `src/server.ts`, `vite.config.ts`) and the scheduled-videos webhook endpoint
2. **Enable Lovable Cloud** to get the built-in database, user sign-in, and storage — the app depends on it.
3. **Create the database** from the repo's migration files:
   - Tables: profiles, projects, sources, ideas, scripts, videos, channels, posts, cron_config
   - Required access rules (row-level security) and grants so only the owner sees their data
4. **Wire up sign-in** with Lovable Cloud auth (email; Google sign-in available on request).
5. **Verify**: app builds, sign-in works, each workspace page loads, the AI chat answers, and the scheduled-videos endpoint rejects bad tokens and accepts the configured one.
6. **Record tracking**: write the migration ledger (`.lovable/migrate-external-project/ledger.json`) marking code/schema as migrated and records as pending.

## Technical details

- Source is TanStack Start + Supabase + Lovable AI Gateway — identical to this template, so it's a file copy, not a rewrite.
- AI features use the built-in Lovable AI (no keys needed from you); the scheduler webhook uses a secret token stored in the database.
- The repo's Drizzle files are only a schema mirror for local tooling; the real schema comes from the Supabase migrations, which I'll apply.
- SEO/head metadata will be checked on the visible pages.

## Still needed afterward

- **Your existing data**: the GitHub repo contains code only, no user data. After the preview is up, export your tables as CSV/JSON from your current project's database (Cloud → Advanced settings → Export data) and share them — or reply "Skip for now."
- **Scheduler**: the timed video job needs an external cron caller pointing at the new URL once published.
