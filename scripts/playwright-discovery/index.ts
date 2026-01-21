/**
 * Playwright Discovery Agent
 * 
 * Discovers social media posts for intent analysis.
 * Runs via GitHub Actions on a schedule.
 * Posts findings to a webhook for the Intent Detection Agent to analyze.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

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

// Product-specific configuration for better discovery
function getProductConfig(campaign: Campaign): { subreddits: string[]; keywords: string[] } {
  const productLower = campaign.product.toLowerCase();
  
  // Cover letter / job seeker products (check for both "cover letter" and "coverletter")
  if (productLower.includes('cover letter') || productLower.includes('coverletter') || productLower.includes('resume') || productLower.includes('job seeker')) {
    return {
      subreddits: ['jobs', 'careerguidance', 'resumes', 'GetEmployed', 'jobsearchhacks', 'recruitinghell', 'antiwork'],
      keywords: ['cover letter', 'resume', 'job application', 'applying for jobs', 'job search', 'hiring manager']
    };
  }
  
  // Travel / airport products
  if (productLower.includes('airport') || productLower.includes('travel') || productLower.includes('flight') || productLower.includes('tsa')) {
    return {
      subreddits: ['travel', 'TravelHacks', 'Flights', 'TravelNoPics', 'solotravel', 'digitalnomad'],
      keywords: ['airport', 'tsa wait', 'flight delay', 'travel tips', 'flying', 'layover']
    };
  }
  
  // Marketing / business products
  if (productLower.includes('marketing') || productLower.includes('social media') || productLower.includes('etsy')) {
    return {
      subreddits: ['smallbusiness', 'Entrepreneur', 'marketing', 'Etsy', 'ecommerce', 'socialmedia'],
      keywords: ['marketing', 'promote', 'social media', 'engagement', 'grow audience', 'traffic']
    };
  }
  
  // Default fallback
  return {
    subreddits: ['smallbusiness', 'Entrepreneur', 'startups'],
    keywords: campaign.product.split(' ').filter(w => w.length > 3).slice(0, 3)
  };
}

function generateSearchQueries(campaign: Campaign): string[] {
  const queries: string[] = [];
  const config = getProductConfig(campaign);
  
  // Generate queries based on product keywords and help phrases
  for (const keyword of config.keywords.slice(0, 3)) {
    for (const phrase of HELP_PHRASES.slice(0, 3)) {
      queries.push(`${phrase} ${keyword}`);
    }
  }
  
  return queries;
}

// ─────────────────────────────────────────────────────────────
// REDDIT DISCOVERY
// ─────────────────────────────────────────────────────────────

async function discoverReddit(
  page: Page,
  campaign: Campaign
): Promise<DiscoveredPost[]> {
  const posts: DiscoveredPost[] = [];
  const queries = generateSearchQueries(campaign);
  
  log(`Starting Reddit discovery for campaign: ${campaign.name}`);
  
  // Get product-specific subreddits
  const config = getProductConfig(campaign);
  const subreddits = config.subreddits;
  
  log(`Using subreddits: ${subreddits.join(', ')}`);
  
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
      
      // Check each post for relevance using product-specific keywords
      const productConfig = getProductConfig(campaign);
      
      for (const post of redditPosts) {
        if (posts.length >= CONFIG.maxItemsPerPlatform) break;
        
        const titleLower = post.title.toLowerCase();
        
        // Check for help-seeking phrases OR product-specific keywords
        const hasHelpPhrase = HELP_PHRASES.some(phrase => 
          titleLower.includes(phrase.toLowerCase())
        );
        const hasKeyword = productConfig.keywords.some(keyword =>
          titleLower.includes(keyword.toLowerCase())
        );
        
        // For job-seeker subreddits, most posts are relevant - just check for help phrases
        // For other subreddits, require keyword match
        const isJobSeekerSubreddit = ['jobs', 'careerguidance', 'resumes', 'GetEmployed', 'jobsearchhacks'].includes(subreddit);
        const isRelevant = isJobSeekerSubreddit ? hasHelpPhrase || hasKeyword : hasHelpPhrase && hasKeyword;
        
        if (isRelevant || (isJobSeekerSubreddit && posts.length < 5)) {
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
  campaign: Campaign
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
// FACEBOOK DISCOVERY (requires login)
// ─────────────────────────────────────────────────────────────

async function discoverFacebook(
  page: Page,
  context: BrowserContext,
  campaign: Campaign
): Promise<DiscoveredPost[]> {
  const posts: DiscoveredPost[] = [];
  
  const email = process.env.FACEBOOK_EMAIL;
  const password = process.env.FACEBOOK_PASSWORD;
  
  if (!email || !password) {
    log('Facebook credentials not provided, skipping', 'warn');
    return posts;
  }
  
  log(`Starting Facebook discovery for campaign: ${campaign.name}`);
  
  try {
    // Navigate to Facebook
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);
    
    // Check if already logged in
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="email"]');
    });
    
    if (!isLoggedIn) {
      log('Logging into Facebook...');
      
      // Accept cookies if dialog appears
      try {
        const cookieButton = await page.$('button[data-cookiebanner="accept_button"]');
        if (cookieButton) {
          await cookieButton.click();
          await randomDelay(1000, 2000);
        }
      } catch (e) {
        // Cookie banner might not appear
      }
      
      await page.fill('input[name="email"]', email);
      await randomDelay(500, 1000);
      await page.fill('input[name="pass"]', password);
      await randomDelay(500, 1000);
      await page.click('button[name="login"]');
      
      // Wait for redirect
      await page.waitForNavigation({ timeout: 30000 });
      await randomDelay(2000, 3000);
      
      // Check for checkpoint/verification
      const isCheckpoint = page.url().includes('checkpoint');
      if (isCheckpoint) {
        log('Facebook requires verification - stopping', 'error');
        await page.screenshot({ path: 'screenshots/facebook-checkpoint.png' });
        return posts;
      }
      
      log('Facebook login successful');
    }
    
    // Generate search queries based on campaign
    const queries = generateSearchQueries(campaign);
    
    // Search for relevant posts
    for (const query of queries.slice(0, 3)) {
      if (posts.length >= CONFIG.maxItemsPerPlatform) break;
      
      try {
        log(`Searching Facebook for: "${query}"`);
        
        // Navigate to search
        const searchUrl = `https://www.facebook.com/search/posts?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
        
        // Scroll to load content
        for (let i = 0; i < 3; i++) {
          await page.keyboard.press('PageDown');
          await randomDelay(2000, 3000);
        }
        
        // Extract posts
        const fbPosts = await page.evaluate(() => {
          const items: any[] = [];
          
          // Facebook's dynamic class names make this tricky
          // Look for post containers
          const postElements = document.querySelectorAll('[role="article"]');
          
          postElements.forEach((el, index) => {
            if (index >= 5) return;
            
            // Get text content
            const textContent = el.textContent?.trim() || '';
            
            // Try to find the permalink
            const links = el.querySelectorAll('a[href*="/posts/"], a[href*="/groups/"]');
            let postUrl = '';
            links.forEach(link => {
              const href = (link as HTMLAnchorElement).href;
              if (href.includes('/posts/') || href.includes('/groups/')) {
                postUrl = href;
              }
            });
            
            if (textContent.length > 50) {
              items.push({
                content: textContent.substring(0, 2000),
                url: postUrl || window.location.href,
              });
            }
          });
          
          return items;
        });
        
        for (const post of fbPosts) {
          if (posts.length >= CONFIG.maxItemsPerPlatform) break;
          
          const contentLower = post.content.toLowerCase();
          const isRelevant = HELP_PHRASES.some(phrase => 
            contentLower.includes(phrase.toLowerCase())
          );
          
          if (isRelevant) {
            posts.push({
              platform: 'facebook',
              url: post.url,
              title: post.content.substring(0, 100),
              content: post.content,
            });
            
            log(`Found relevant Facebook post: "${post.content.substring(0, 50)}..."`);
          }
        }
        
        await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
        
      } catch (error) {
        log(`Error searching Facebook for "${query}": ${error}`, 'warn');
      }
    }
    
    // Also check Groups if user is a member of relevant ones
    try {
      log('Checking Facebook Groups...');
      await page.goto('https://www.facebook.com/groups/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
      
      // Scroll through groups feed
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('PageDown');
        await randomDelay(2000, 3000);
      }
      
      const groupPosts = await page.evaluate(() => {
        const items: any[] = [];
        const postElements = document.querySelectorAll('[role="article"]');
        
        postElements.forEach((el, index) => {
          if (index >= 10) return;
          
          const textContent = el.textContent?.trim() || '';
          const links = el.querySelectorAll('a[href*="/groups/"]');
          let groupName = '';
          let postUrl = '';
          
          links.forEach(link => {
            const href = (link as HTMLAnchorElement).href;
            if (href.includes('/groups/')) {
              postUrl = href;
              groupName = (link as HTMLAnchorElement).textContent?.trim() || '';
            }
          });
          
          if (textContent.length > 50) {
            items.push({
              content: textContent.substring(0, 2000),
              url: postUrl,
              group: groupName,
            });
          }
        });
        
        return items;
      });
      
      for (const post of groupPosts) {
        if (posts.length >= CONFIG.maxItemsPerPlatform) break;
        
        const contentLower = post.content.toLowerCase();
        const isRelevant = HELP_PHRASES.some(phrase => 
          contentLower.includes(phrase.toLowerCase())
        );
        
        if (isRelevant) {
          posts.push({
            platform: 'facebook',
            url: post.url,
            title: post.content.substring(0, 100),
            content: post.content,
            group: post.group,
          });
        }
      }
      
    } catch (error) {
      log(`Error checking Facebook Groups: ${error}`, 'warn');
    }
    
  } catch (error) {
    log(`Facebook discovery error: ${error}`, 'error');
    if (CONFIG.screenshotOnError) {
      await page.screenshot({ path: 'screenshots/facebook-error.png' });
    }
  }
  
  log(`Facebook discovery complete: ${posts.length} posts found`);
  return posts;
}

// ─────────────────────────────────────────────────────────────
// NEXTDOOR DISCOVERY (requires login)
// ─────────────────────────────────────────────────────────────

async function discoverNextdoor(
  page: Page,
  context: BrowserContext,
  campaign: Campaign
): Promise<DiscoveredPost[]> {
  const posts: DiscoveredPost[] = [];
  
  const email = process.env.NEXTDOOR_EMAIL;
  const password = process.env.NEXTDOOR_PASSWORD;
  
  if (!email || !password) {
    log('Nextdoor credentials not provided, skipping', 'warn');
    return posts;
  }
  
  log(`Starting Nextdoor discovery for campaign: ${campaign.name}`);
  
  try {
    // Navigate to Nextdoor
    await page.goto('https://nextdoor.com/login/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);
    
    // Check if already logged in (redirected to feed)
    const isLoggedIn = page.url().includes('/news_feed/') || page.url().includes('/neighborhood_feed/');
    
    if (!isLoggedIn && page.url().includes('/login')) {
      log('Logging into Nextdoor...');
      
      // Nextdoor login flow
      await page.fill('input[name="email"], input[type="email"]', email);
      await randomDelay(500, 1000);
      
      // Click continue/next button
      const continueButton = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")');
      if (continueButton) {
        await continueButton.click();
        await randomDelay(2000, 3000);
      }
      
      // Enter password
      await page.fill('input[name="password"], input[type="password"]', password);
      await randomDelay(500, 1000);
      
      // Submit login
      const signInButton = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
      if (signInButton) {
        await signInButton.click();
      }
      
      // Wait for navigation
      await page.waitForNavigation({ timeout: 30000 });
      await randomDelay(3000, 5000);
      
      // Check for verification requirements
      if (page.url().includes('verify') || page.url().includes('confirm')) {
        log('Nextdoor requires verification - stopping', 'error');
        await page.screenshot({ path: 'screenshots/nextdoor-verification.png' });
        return posts;
      }
      
      log('Nextdoor login successful');
    }
    
    // Navigate to the main feed
    await page.goto('https://nextdoor.com/news_feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
    
    // Scroll to load content
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('PageDown');
      await randomDelay(2000, 3500);
    }
    
    // Extract posts from the feed
    const feedPosts = await page.evaluate(() => {
      const items: any[] = [];
      
      // Nextdoor uses various selectors for posts
      const postSelectors = [
        '[data-testid="post-card"]',
        '.post-card',
        '[class*="PostCard"]',
        'article',
      ];
      
      let postElements: NodeListOf<Element> | null = null;
      for (const selector of postSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          postElements = elements;
          break;
        }
      }
      
      if (!postElements) {
        // Fallback: try to find any content containers
        postElements = document.querySelectorAll('[role="main"] > div > div');
      }
      
      postElements?.forEach((el, index) => {
        if (index >= 15) return;
        
        const textContent = el.textContent?.trim() || '';
        
        // Find any links to post detail pages
        const links = el.querySelectorAll('a[href*="/post/"], a[href*="/p/"]');
        let postUrl = '';
        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          if (href.includes('/post/') || href.includes('/p/')) {
            postUrl = href;
          }
        });
        
        // Only include posts with substantial content
        if (textContent.length > 100 && textContent.length < 5000) {
          items.push({
            content: textContent,
            url: postUrl || window.location.href,
          });
        }
      });
      
      return items;
    });
    
    for (const post of feedPosts) {
      if (posts.length >= CONFIG.maxItemsPerPlatform) break;
      
      const contentLower = post.content.toLowerCase();
      
      // Check for help-seeking language
      const isHelpSeeking = HELP_PHRASES.some(phrase => 
        contentLower.includes(phrase.toLowerCase())
      );
      
      // Check for recommendation requests (common on Nextdoor)
      const isRecommendation = [
        'recommend',
        'suggestion',
        'anyone know a',
        'looking for a',
        'need a good',
        'who do you use for',
        'does anyone have',
      ].some(phrase => contentLower.includes(phrase));
      
      if (isHelpSeeking || isRecommendation) {
        posts.push({
          platform: 'nextdoor',
          url: post.url,
          title: post.content.substring(0, 100),
          content: post.content,
        });
        
        log(`Found relevant Nextdoor post: "${post.content.substring(0, 50)}..."`);
      }
    }
    
    // Also check the "Recommendations" section if available
    try {
      log('Checking Nextdoor Recommendations section...');
      await page.goto('https://nextdoor.com/recommendations/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(CONFIG.scrollPauseMin, CONFIG.scrollPauseMax);
      
      // Scroll through recommendations
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('PageDown');
        await randomDelay(2000, 3000);
      }
      
      const recoPosts = await page.evaluate(() => {
        const items: any[] = [];
        const elements = document.querySelectorAll('[data-testid="recommendation-card"], article, [class*="Recommendation"]');
        
        elements.forEach((el, index) => {
          if (index >= 10) return;
          
          const textContent = el.textContent?.trim() || '';
          const links = el.querySelectorAll('a');
          let postUrl = '';
          
          links.forEach(link => {
            const href = (link as HTMLAnchorElement).href;
            if (href.includes('nextdoor.com')) {
              postUrl = href;
            }
          });
          
          if (textContent.length > 50) {
            items.push({
              content: textContent.substring(0, 2000),
              url: postUrl || window.location.href,
            });
          }
        });
        
        return items;
      });
      
      for (const post of recoPosts) {
        if (posts.length >= CONFIG.maxItemsPerPlatform) break;
        
        // All recommendation posts are inherently relevant
        posts.push({
          platform: 'nextdoor',
          url: post.url,
          title: post.content.substring(0, 100),
          content: post.content,
        });
      }
      
    } catch (error) {
      log(`Error checking Nextdoor Recommendations: ${error}`, 'warn');
    }
    
  } catch (error) {
    log(`Nextdoor discovery error: ${error}`, 'error');
    if (CONFIG.screenshotOnError) {
      await page.screenshot({ path: 'screenshots/nextdoor-error.png' });
    }
  }
  
  log(`Nextdoor discovery complete: ${posts.length} posts found`);
  return posts;
}

// ─────────────────────────────────────────────────────────────
// SAVE FINDINGS VIA WEBHOOK
// ─────────────────────────────────────────────────────────────

async function saveFindings(
  webhookUrl: string,
  webhookSecret: string,
  campaignId: string,
  posts: DiscoveredPost[],
  platform: string
): Promise<number> {
  if (posts.length === 0) {
    log('No posts to save');
    return 0;
  }
  
  const findings = posts.map(post => ({
    title: post.title.substring(0, 500),
    content: post.content.substring(0, 5000),
    source_url: post.url,
    platform: post.platform,
    author: post.author,
    posted_at: post.timestamp,
  }));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({
        campaign_id: campaignId,
        findings,
        platform,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Webhook error (${response.status}): ${errorText}`, 'error');
      return 0;
    }
    
    const result = await response.json();
    log(`Webhook response: saved=${result.saved}, duplicates=${result.duplicates}`);
    return result.saved || 0;
    
  } catch (error) {
    log(`Error calling webhook: ${error}`, 'error');
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────

async function main() {
  log('🚀 Starting Playwright Discovery Agent');
  
  // Get webhook configuration
  const webhookUrl = process.env.WEBHOOK_URL;
  const webhookSecret = process.env.DISCOVERY_WEBHOOK_SECRET;
  
  if (!webhookUrl || !webhookSecret) {
    log('Missing WEBHOOK_URL or DISCOVERY_WEBHOOK_SECRET', 'error');
    process.exit(1);
  }
  
  // Get campaign configuration from environment
  const campaignId = process.env.CAMPAIGN_ID;
  const campaignName = process.env.CAMPAIGN_NAME || 'Default Campaign';
  const campaignProduct = process.env.CAMPAIGN_PRODUCT || 'marketing automation';
  
  if (!campaignId) {
    log('Missing CAMPAIGN_ID - please specify which campaign to run', 'error');
    process.exit(1);
  }
  
  // Build campaign object from environment
  const campaign: Campaign = {
    id: campaignId,
    name: campaignName,
    product: campaignProduct,
    channels: (process.env.CAMPAIGN_CHANNELS || 'reddit').split(','),
    goals: [],
  };
  
  // Get platforms to run
  const platforms = (process.env.PLATFORMS || 'reddit').split(',').map(p => p.trim().toLowerCase());
  
  log(`Campaign: ${campaign.name} (${campaign.id})`);
  log(`Platforms: ${platforms.join(', ')}`);
  
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
    log(`\n📊 Processing campaign: ${campaign.name}`);
    
    let totalPosts: DiscoveredPost[] = [];
    
    // Run discovery for each platform
    if (platforms.includes('reddit')) {
      const redditPosts = await discoverReddit(page, campaign);
      totalPosts = totalPosts.concat(redditPosts);
    }
    
    if (platforms.includes('linkedin')) {
      const linkedInPosts = await discoverLinkedIn(page, context, campaign);
      totalPosts = totalPosts.concat(linkedInPosts);
    }
    
    if (platforms.includes('facebook')) {
      const facebookPosts = await discoverFacebook(page, context, campaign);
      totalPosts = totalPosts.concat(facebookPosts);
    }
    
    if (platforms.includes('nextdoor')) {
      const nextdoorPosts = await discoverNextdoor(page, context, campaign);
      totalPosts = totalPosts.concat(nextdoorPosts);
    }
    
    // Save findings via webhook
    const savedCount = await saveFindings(
      webhookUrl,
      webhookSecret,
      campaign.id,
      totalPosts,
      platforms.join(',')
    );
    log(`💾 Saved ${savedCount} new findings for campaign: ${campaign.name}`);
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
