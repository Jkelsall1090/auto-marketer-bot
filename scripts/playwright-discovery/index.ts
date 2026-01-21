/**
 * Playwright Discovery Agent
 * 
 * Discovers social media posts for intent analysis.
 * Runs via GitHub Actions on a schedule.
 * Saves findings directly to Supabase for the Intent Detection Agent to analyze.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  maxItemsPerPlatform: 20,
  scrollPauseMin: 2000,
  scrollPauseMax: 5000,
  actionPauseMin: 1000,
  actionPauseMax: 3000,
  screenshotOnError: true,
};

// Help-seeking phrases to look for
const HELP_PHRASES = [
  'anyone know',
  'looking for',
  'need help',
  'struggling with',
  'recommendations for',
  'best way to',
  'how do i',
  'can someone',
  'advice on',
  'tips for',
  'suggestions for',
  'recommend a',
  'where can i find',
  'does anyone have',
];

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  product: string;
  channels: string[];
  goals: string[];
}

interface DiscoveredPost {
  platform: string;
  url: string;
  title: string;
  content: string;
  author?: string;
  timestamp?: string;
  engagement?: {
    upvotes?: number;
    comments?: number;
    likes?: number;
  };
  subreddit?: string;
  group?: string;
  hashtags?: string[];
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = { info: '📋', warn: '⚠️', error: '❌' }[level];
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

function generateSearchQueries(campaign: Campaign): string[] {
  const queries: string[] = [];
  const productKeywords = campaign.product.toLowerCase().split(' ');
  
  // Generate queries based on product and help phrases
  for (const phrase of HELP_PHRASES.slice(0, 5)) {
    queries.push(`${phrase} ${productKeywords[0]}`);
  }
  
  // Add product-specific queries
  queries.push(campaign.product);
  
  return queries;
}

// ─────────────────────────────────────────────────────────────
// REDDIT DISCOVERY
// ─────────────────────────────────────────────────────────────

async function discoverReddit(
  page: Page,
  campaign: Campaign,
  supabase: SupabaseClient
): Promise<DiscoveredPost[]> {
  const posts: DiscoveredPost[] = [];
  const queries = generateSearchQueries(campaign);
  
  log(`Starting Reddit discovery for campaign: ${campaign.name}`);
  
  // Target subreddits based on product
  const subreddits = [
    'smallbusiness',
    'Entrepreneur',
    'startups',
    'marketing',
    'socialmedia',
    'freelance',
  ];
  
  for (const subreddit of subreddits) {
    if (posts.length >= CONFIG.maxItemsPerPlatform) break;
    
    try {
      log(`Searching r/${subreddit}...`);
      
      // Navigate to subreddit
      await page.goto(`https://old.reddit.com/r/${subreddit}/new/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      
      await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
      
      // Scroll down a few times to load content
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('PageDown');
        await randomDelay(1000, 2000);
      }
      
      // Extract posts
      const redditPosts = await page.evaluate(() => {
        const items: any[] = [];
        const postElements = document.querySelectorAll('.thing.link');
        
        postElements.forEach((el, index) => {
          if (index >= 10) return; // Limit per subreddit
          
          const titleEl = el.querySelector('a.title');
          const authorEl = el.querySelector('.author');
          const scoreEl = el.querySelector('.score.unvoted');
          const commentsEl = el.querySelector('.comments');
          const timeEl = el.querySelector('time');
          
          if (titleEl) {
            items.push({
              title: titleEl.textContent?.trim() || '',
              url: (titleEl as HTMLAnchorElement).href || '',
              author: authorEl?.textContent?.trim() || '',
              score: scoreEl?.textContent?.trim() || '0',
              comments: commentsEl?.textContent?.match(/\d+/)?.[0] || '0',
              timestamp: timeEl?.getAttribute('datetime') || '',
            });
          }
        });
        
        return items;
      });
      
      // Check each post for relevance
      for (const post of redditPosts) {
        if (posts.length >= CONFIG.maxItemsPerPlatform) break;
        
        const titleLower = post.title.toLowerCase();
        const isRelevant = HELP_PHRASES.some(phrase => 
          titleLower.includes(phrase.toLowerCase())
        ) || campaign.product.toLowerCase().split(' ').some(word =>
          titleLower.includes(word)
        );
        
        if (isRelevant) {
          // Navigate to post to get full content
          await page.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await randomDelay(CONFIG.actionPauseMin, CONFIG.actionPauseMax);
          
          const fullContent = await page.evaluate(() => {
            const selftext = document.querySelector('.usertext-body .md');
            return selftext?.textContent?.trim() || '';
          });
          
          posts.push({
            platform: 'reddit',
            url: post.url,
            title: post.title,
            content: fullContent || post.title,
            author: post.author,
            timestamp: post.timestamp,
            subreddit,
            engagement: {
              upvotes: parseInt(post.score) || 0,
              comments: parseInt(post.comments) || 0,
            },
          });
          
          log(`Found relevant post: "${post.title.substring(0, 50)}..."`);
        }
      }
      
      await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
      
    } catch (error) {
      log(`Error in r/${subreddit}: ${error}`, 'warn');
    }
  }
  
  // Also do keyword searches
  for (const query of queries.slice(0, 3)) {
    if (posts.length >= CONFIG.maxItemsPerPlatform) break;
    
    try {
      log(`Searching Reddit for: "${query}"`);
      
      const searchUrl = `https://old.reddit.com/search?q=${encodeURIComponent(query)}&sort=new&t=week`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
      
      const searchResults = await page.evaluate(() => {
        const items: any[] = [];
        const postElements = document.querySelectorAll('.thing.link');
        
        postElements.forEach((el, index) => {
          if (index >= 5) return;
          
          const titleEl = el.querySelector('a.title');
          const subredditEl = el.querySelector('.subreddit');
          
          if (titleEl) {
            items.push({
              title: titleEl.textContent?.trim() || '',
              url: (titleEl as HTMLAnchorElement).href || '',
              subreddit: subredditEl?.textContent?.trim() || '',
            });
          }
        });
        
        return items;
      });
      
      for (const result of searchResults) {
        if (posts.length >= CONFIG.maxItemsPerPlatform) break;
        
        // Check if we already have this URL
        if (posts.some(p => p.url === result.url)) continue;
        
        posts.push({
          platform: 'reddit',
          url: result.url,
          title: result.title,
          content: result.title,
          subreddit: result.subreddit,
        });
      }
      
    } catch (error) {
      log(`Error searching "${query}": ${error}`, 'warn');
    }
  }
  
  log(`Reddit discovery complete: ${posts.length} posts found`);
  return posts;
}

// ─────────────────────────────────────────────────────────────
// LINKEDIN DISCOVERY (requires login)
// ─────────────────────────────────────────────────────────────

async function discoverLinkedIn(
  page: Page,
  context: BrowserContext,
  campaign: Campaign,
  supabase: SupabaseClient
): Promise<DiscoveredPost[]> {
  const posts: DiscoveredPost[] = [];
  
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  
  if (!email || !password) {
    log('LinkedIn credentials not provided, skipping', 'warn');
    return posts;
  }
  
  log(`Starting LinkedIn discovery for campaign: ${campaign.name}`);
  
  try {
    // Check if already logged in
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);
    
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('.sign-in-form');
    });
    
    if (!isLoggedIn) {
      log('Logging into LinkedIn...');
      await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
      await randomDelay(1000, 2000);
      
      await page.fill('#username', email);
      await randomDelay(500, 1000);
      await page.fill('#password', password);
      await randomDelay(500, 1000);
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/feed/**', { timeout: 30000 });
      log('LinkedIn login successful');
      
      // Save session
      await context.storageState({ path: '.linkedin-session.json' });
    }
    
    // Search for relevant hashtags
    const hashtags = ['#smallbusiness', '#entrepreneur', '#startup', '#marketing'];
    
    for (const hashtag of hashtags) {
      if (posts.length >= CONFIG.maxItemsPerPlatform) break;
      
      try {
        const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(hashtag)}&sortBy=%22date_posted%22`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
        
        // Scroll to load content
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('PageDown');
          await randomDelay(1500, 2500);
        }
        
        const linkedInPosts = await page.evaluate(() => {
          const items: any[] = [];
          const postElements = document.querySelectorAll('.feed-shared-update-v2');
          
          postElements.forEach((el, index) => {
            if (index >= 5) return;
            
            const textEl = el.querySelector('.feed-shared-text');
            const authorEl = el.querySelector('.update-components-actor__name');
            
            if (textEl) {
              items.push({
                content: textEl.textContent?.trim() || '',
                author: authorEl?.textContent?.trim() || '',
              });
            }
          });
          
          return items;
        });
        
        for (const post of linkedInPosts) {
          if (posts.length >= CONFIG.maxItemsPerPlatform) break;
          
          const contentLower = post.content.toLowerCase();
          const isRelevant = HELP_PHRASES.some(phrase => 
            contentLower.includes(phrase.toLowerCase())
          );
          
          if (isRelevant) {
            posts.push({
              platform: 'linkedin',
              url: page.url(),
              title: post.content.substring(0, 100),
              content: post.content,
              author: post.author,
              hashtags: [hashtag],
            });
            
            log(`Found relevant LinkedIn post: "${post.content.substring(0, 50)}..."`);
          }
        }
        
      } catch (error) {
        log(`Error searching ${hashtag}: ${error}`, 'warn');
      }
    }
    
  } catch (error) {
    log(`LinkedIn discovery error: ${error}`, 'error');
    if (CONFIG.screenshotOnError) {
      await page.screenshot({ path: 'screenshots/linkedin-error.png' });
    }
  }
  
  log(`LinkedIn discovery complete: ${posts.length} posts found`);
  return posts;
}

// ─────────────────────────────────────────────────────────────
// SAVE FINDINGS TO SUPABASE
// ─────────────────────────────────────────────────────────────

async function saveFindings(
  supabase: SupabaseClient,
  campaignId: string,
  posts: DiscoveredPost[]
): Promise<number> {
  let savedCount = 0;
  
  for (const post of posts) {
    try {
      // Check if we already have this URL
      const { data: existing } = await supabase
        .from('research_findings')
        .select('id')
        .eq('source_url', post.url)
        .single();
      
      if (existing) {
        log(`Skipping duplicate: ${post.url}`);
        continue;
      }
      
      const { error } = await supabase.from('research_findings').insert({
        campaign_id: campaignId,
        finding_type: `${post.platform}_opportunity`,
        title: post.title.substring(0, 500),
        content: post.content.substring(0, 5000),
        source_url: post.url,
        relevance_score: 50, // Default, intent agent will re-score
        processed: false,
        emotional_signals: [],
        constraints: [],
      });
      
      if (error) {
        log(`Error saving finding: ${error.message}`, 'error');
      } else {
        savedCount++;
      }
      
    } catch (error) {
      log(`Error saving post: ${error}`, 'error');
    }
  }
  
  return savedCount;
}

// ─────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────

async function main() {
  log('🚀 Starting Playwright Discovery Agent');
  
  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    log('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 'error');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get platforms to run
  const platforms = (process.env.PLATFORMS || 'reddit').split(',').map(p => p.trim().toLowerCase());
  const targetCampaignId = process.env.CAMPAIGN_ID;
  
  log(`Platforms: ${platforms.join(', ')}`);
  
  // Fetch campaigns
  let query = supabase.from('campaigns').select('*').eq('status', 'active');
  
  if (targetCampaignId) {
    query = query.eq('id', targetCampaignId);
  }
  
  const { data: campaigns, error: campaignError } = await query;
  
  if (campaignError || !campaigns?.length) {
    log(`No active campaigns found: ${campaignError?.message || 'empty result'}`, 'error');
    process.exit(1);
  }
  
  log(`Found ${campaigns.length} campaign(s) to process`);
  
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  
  const page = await context.newPage();
  
  // Create screenshots directory
  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots', { recursive: true });
  }
  
  try {
    for (const campaign of campaigns) {
      log(`\n📊 Processing campaign: ${campaign.name}`);
      
      let totalPosts: DiscoveredPost[] = [];
      
      // Run discovery for each platform
      if (platforms.includes('reddit')) {
        const redditPosts = await discoverReddit(page, campaign, supabase);
        totalPosts = totalPosts.concat(redditPosts);
      }
      
      if (platforms.includes('linkedin')) {
        const linkedInPosts = await discoverLinkedIn(page, context, campaign, supabase);
        totalPosts = totalPosts.concat(linkedInPosts);
      }
      
      // Save findings
      const savedCount = await saveFindings(supabase, campaign.id, totalPosts);
      log(`💾 Saved ${savedCount} new findings for campaign: ${campaign.name}`);
      
      // Update agent state
      await supabase
        .from('agent_state')
        .upsert({
          campaign_id: campaign.id,
          phase: 'research',
          last_run_at: new Date().toISOString(),
          opportunities_queued: savedCount,
        }, { onConflict: 'campaign_id' });
    }
    
  } catch (error) {
    log(`Fatal error: ${error}`, 'error');
    await page.screenshot({ path: 'screenshots/fatal-error.png' });
    throw error;
  } finally {
    await browser.close();
  }
  
  log('\n✅ Discovery complete!');
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
