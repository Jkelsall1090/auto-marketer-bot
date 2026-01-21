# Playwright Discovery Agent

Browser-based RPA agent that discovers social media posts for intent analysis.

## How It Works

1. **GitHub Actions** runs the Playwright script on a schedule (every 6 hours by default)
2. **Playwright** browses Reddit, LinkedIn, etc. like a real user
3. **Discoveries** are saved directly to the `research_findings` table in Supabase
4. **Intent Analysis** runs via the existing `agent-research` edge function

## Setup

### 1. Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

**Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

**Optional (for logged-in discovery):**
- `REDDIT_USERNAME` / `REDDIT_PASSWORD`
- `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD`
- `FACEBOOK_EMAIL` / `FACEBOOK_PASSWORD`
- `NEXTDOOR_EMAIL` / `NEXTDOOR_PASSWORD`

### 2. Enable the Workflow

The workflow runs automatically every 6 hours. You can also trigger it manually:

1. Go to Actions tab in your GitHub repo
2. Select "Social Media Discovery" workflow
3. Click "Run workflow"
4. Optionally specify a campaign ID or platforms

## Platforms

| Platform | Login Required | Status |
|----------|---------------|--------|
| Reddit | No (public subreddits) | ✅ Ready |
| LinkedIn | Yes | ✅ Ready |
| Facebook | Yes | ✅ Ready |
| Nextdoor | Yes | ✅ Ready |

## Human-Like Behavior

The agent behaves like a real user:
- Random delays between actions (2-8 seconds)
- Slow scrolling with PageDown
- Uses real browser with proper user agent
- Saves screenshots on errors for debugging

## Development

```bash
cd scripts/playwright-discovery

# Install dependencies
npm install

# Run locally (requires environment variables)
npm run discover

# Debug mode with extra logging
npm run discover:debug
```

## Troubleshooting

- **Login blocked?** Platforms may require CAPTCHA verification. Log in manually once, then the session should persist.
- **No findings?** Check the screenshot artifacts in the Actions run for visual debugging.
- **Rate limited?** Reduce the frequency in `.github/workflows/playwright-discovery.yml`
