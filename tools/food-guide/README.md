# Food Guide 🍽️

Personal restaurant database with social review aggregation and smart recommendations.

## Features

- **Restaurant Database** — Track visited spots, ratings, vibes, occasions, dishes
- **People Preferences** — Store dining preferences for friends/family (PARTNER_NAME likes X, mom hates Y)
- **Smart Recommendations** — `--with parri --occasion date` filters by her preferences
- **Social Score Aggregation** — Pulls reviews from Google, Yelp, Reddit, TikTok, critics
- **Visit History** — Anti-repeat logic (warns if visited < 2 weeks ago)
- **Wishlist** — Track spots you want to try
- **Random Pick** — For those indecisive moments

## Installation

```bash
cd tools/food-guide
chmod +x guide.js
# Optional: npm link for global 'food' command
```

## Quick Start

```bash
# Add a restaurant
node guide.js add "OSTE" --cuisine italian --price $$ --rating 8 \
  --vibes cozy,romantic --occasions date,family \
  --visited 2026-02-28 --with mom,sister

# Search for restaurants
node guide.js search --cuisine italian --vibe cozy --price $$

# Get recommendations
node guide.js recommend --occasion date --with parri

# Add to wishlist
node guide.js add "Bestia" --wishlist "Chris recommended, need reservation"

# Random pick
node guide.js random --cuisine sushi --minDays 14

# Track people preferences
node guide.js people parri --likes-cuisine italian,sushi --dislikes-cuisine chinese

# Enrich with social data
node guide.js enrich "OSTE"
```

## Commands

| Command | Description |
|---------|-------------|
| `add <name>` | Add or update a restaurant |
| `search` | Filter restaurants by criteria |
| `recommend` | Get smart recommendations |
| `wishlist` | Manage want-to-try list |
| `history` | Show recent visits |
| `random` | Pick a random spot |
| `info <name>` | Full details on a restaurant |
| `people` | Manage people preferences |
| `enrich` | Fetch social review data |
| `stats` | Summary statistics |
| `export` | Export data (text/json) |

## Add Options

```
--cuisine <type>      italian, sushi, mexican, etc.
--neighborhood <area> WeHo, DTLA, Santa Monica, etc.
--price <tier>        $, $$, $$$, $$$$
--rating <1-10>       Your personal rating
--vibes <tags>        cozy, lively, upscale, casual, romantic...
--occasions <tags>    date, family, friends, solo, work...
--notes <text>        Personal notes
--wishlist [reason]   Add to wishlist
--visited <date>      Last visit date (YYYY-MM-DD)
--with <people>       Who you went with (comma-separated)
--dish <name>         Dish you tried (use multiple times)
--enrich              Fetch social reviews on add
```

## Search/Filter Options

```
--cuisine <type>      Filter by cuisine
--neighborhood <area> Filter by neighborhood (or --hood)
--price <tier>        Filter by price
--vibe <tag>          Filter by vibe
--occasion <tag>      Filter by occasion
--rating <min>        Minimum rating
--visited             Only visited restaurants
--wishlist            Only wishlist items
--sort <field>        rating, recent, social, distance
--limit <n>           Max results (default 10)
--verbose             Show full details
```

## Recommendation Options

```
--occasion <type>     date, family, friends, etc.
--with <people>       Comma-separated names (uses their preferences)
--maxDistance <miles> Max distance from WeHo
--limit <n>           Number of recommendations
```

## Social Score Aggregation

The `enrich` command fetches reviews from multiple platforms and calculates a composite score:

| Platform | Weight | Data |
|----------|--------|------|
| Google Maps | 25% | Rating, review count |
| Yelp | 20% | Rating, review count |
| Reddit | 20% | Sentiment analysis (r/FoodLosAngeles, r/LosAngeles) |
| TikTok/Instagram | 15% | Hype/trending detection |
| Critics | 10% | Eater, Infatuation, LA Times mentions |
| OpenTable | 10% | Rating, availability |

**Features:**
- **Composite Score** — Weighted average across platforms
- **Review Count Weighting** — 4.5★ from 2,000 reviews > 5.0★ from 12 reviews
- **Theme Extraction** — Common praise/complaints across sources
- **Trending Detection** — Flags spots blowing up on TikTok/IG

## People Preferences

Store dietary restrictions, cuisine preferences, and notes for dining companions:

```bash
# Add preferences
node guide.js people parri --likes-cuisine italian,sushi --maxPrice $$$
node guide.js people mom --dislikes-cuisine spicy,thai --dietary vegetarian

# Use in recommendations
node guide.js recommend --with mom,parri --occasion family
```

## Neighborhoods

Built-in LA neighborhoods with distances from WeHo (JB's home base):

| Area | Distance |
|------|----------|
| YOUR_AREA | 0 mi |
| Fairfax/Melrose | 2 mi |
| YOUR_NEIGHBORHOOD | 3 mi |
| Hollywood | 4 mi |
| Koreatown | 5 mi |
| Los Feliz | 6 mi |
| Silver Lake | 7 mi |
| Culver City | 8 mi |
| DTLA | 10 mi |
| Santa Monica | 12 mi |
| Venice | 13 mi |
| Pasadena | 15 mi |
| Malibu | 25 mi |

## Data Files

- `restaurants.json` — Restaurant database
- `people.json` — People preferences

## Output Examples

### Search Results
```
🍽️  Found 3 restaurants:

📍 OSTE
   italian | $$ | YOUR_AREA
   Rating: 8/10 ★★★★★★★★☆☆
   Vibes: cozy, romantic, upscale
   Good for: date, family, special-occasion
   📊 Social Score: 4.3/5
   Last visit: 2026-02-28 (1d ago - recent!)
```

### Recommendation
```
🎯 Top picks for date with parri:

1. 📍 OSTE
   italian | $$ | YOUR_AREA
   Rating: 8/10
   Recommendation Score: 87.5/100
```

## Tips

- **Track every visit** with `--visited` and `--with` for better recommendations
- **Add people early** — their preferences power the recommendation engine
- **Use --enrich sparingly** — rate-limited by external APIs
- **Wishlist first** — add spots you hear about, convert to visited when you go
- **Check history** before booking — avoid repeating recent spots

---

Built by Clawd 🐾 | March 2026
