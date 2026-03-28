#!/usr/bin/env node

/**
 * Food Guide - Personal Restaurant Database & Recommendation Engine
 * 
 * Features:
 * - Restaurant database with ratings, vibes, occasions, dishes
 * - People preferences for smart "who's coming" recommendations
 * - Social review aggregation from Google, Yelp, Reddit, TikTok, etc.
 * - History tracking with anti-repeat logic
 * - Wishlist management
 * 
 * Usage: node guide.js <command> [options]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data files
const DATA_DIR = __dirname;
const RESTAURANTS_FILE = path.join(DATA_DIR, 'restaurants.json');
const PEOPLE_FILE = path.join(DATA_DIR, 'people.json');

// Neighborhoods with distances from WeHo (JB's home base)
const NEIGHBORHOODS = {
  'weho': { name: 'YOUR_AREA', distance: 0 },
  'west-hollywood': { name: 'YOUR_AREA', distance: 0 },
  'beverly-hills': { name: 'YOUR_NEIGHBORHOOD', distance: 3 },
  'bh': { name: 'YOUR_NEIGHBORHOOD', distance: 3 },
  'hollywood': { name: 'Hollywood', distance: 4 },
  'silver-lake': { name: 'Silver Lake', distance: 7 },
  'silverlake': { name: 'Silver Lake', distance: 7 },
  'echo-park': { name: 'Echo Park', distance: 8 },
  'dtla': { name: 'Downtown LA', distance: 10 },
  'downtown': { name: 'Downtown LA', distance: 10 },
  'santa-monica': { name: 'Santa Monica', distance: 12 },
  'sm': { name: 'Santa Monica', distance: 12 },
  'venice': { name: 'Venice', distance: 13 },
  'culver-city': { name: 'Culver City', distance: 8 },
  'culver': { name: 'Culver City', distance: 8 },
  'los-feliz': { name: 'Los Feliz', distance: 6 },
  'pasadena': { name: 'Pasadena', distance: 15 },
  'koreatown': { name: 'Koreatown', distance: 5 },
  'ktown': { name: 'Koreatown', distance: 5 },
  'mid-wilshire': { name: 'Mid-Wilshire', distance: 4 },
  'fairfax': { name: 'Fairfax', distance: 2 },
  'melrose': { name: 'Melrose', distance: 2 },
  'century-city': { name: 'Century City', distance: 5 },
  'brentwood': { name: 'Brentwood', distance: 8 },
  'malibu': { name: 'Malibu', distance: 25 },
  'mar-vista': { name: 'Mar Vista', distance: 10 },
  'sawtelle': { name: 'Sawtelle', distance: 9 },
  'westwood': { name: 'Westwood', distance: 7 },
  'highland-park': { name: 'Highland Park', distance: 12 },
  'atwater': { name: 'Atwater Village', distance: 9 },
};

// Cuisine types
const CUISINES = [
  'italian', 'japanese', 'sushi', 'mexican', 'thai', 'chinese', 'korean',
  'vietnamese', 'indian', 'mediterranean', 'french', 'american', 'steakhouse',
  'seafood', 'pizza', 'ramen', 'tacos', 'brunch', 'cafe', 'bakery',
  'ethiopian', 'peruvian', 'greek', 'spanish', 'tapas', 'bbq', 'southern',
  'fusion', 'vegetarian', 'vegan', 'healthy', 'comfort'
];

// Vibe tags
const VIBES = ['cozy', 'lively', 'upscale', 'casual', 'romantic', 'trendy', 'dive', 'hidden-gem', 'instagram', 'loud', 'quiet', 'outdoor', 'rooftop'];

// Occasion tags
const OCCASIONS = ['date', 'family', 'friends', 'solo', 'work', 'celebration', 'casual-dinner', 'special-occasion', 'quick-bite', 'late-night'];

// Price tiers
const PRICE_TIERS = ['$', '$$', '$$$', '$$$$'];

// Load data files
function loadRestaurants() {
  try {
    if (fs.existsSync(RESTAURANTS_FILE)) {
      return JSON.parse(fs.readFileSync(RESTAURANTS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading restaurants:', e.message);
  }
  return [];
}

function loadPeople() {
  try {
    if (fs.existsSync(PEOPLE_FILE)) {
      return JSON.parse(fs.readFileSync(PEOPLE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading people:', e.message);
  }
  return {};
}

function saveRestaurants(data) {
  fs.writeFileSync(RESTAURANTS_FILE, JSON.stringify(data, null, 2));
}

function savePeople(data) {
  fs.writeFileSync(PEOPLE_FILE, JSON.stringify(data, null, 2));
}

// Normalize neighborhood name
function normalizeNeighborhood(input) {
  if (!input) return null;
  const key = input.toLowerCase().replace(/\s+/g, '-');
  if (NEIGHBORHOODS[key]) {
    return { key, ...NEIGHBORHOODS[key] };
  }
  // Fuzzy match
  for (const [k, v] of Object.entries(NEIGHBORHOODS)) {
    if (v.name.toLowerCase().includes(input.toLowerCase()) || k.includes(input.toLowerCase())) {
      return { key: k, ...v };
    }
  }
  // Custom neighborhood
  return { key: input.toLowerCase().replace(/\s+/g, '-'), name: input, distance: null };
}

// Calculate days since last visit
function daysSinceVisit(dateStr) {
  if (!dateStr) return Infinity;
  const visited = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - visited) / (1000 * 60 * 60 * 24));
}

// Format restaurant for display
function formatRestaurant(r, verbose = false) {
  const lines = [];
  const stars = '★'.repeat(Math.round(r.rating || 0)) + '☆'.repeat(10 - Math.round(r.rating || 0));
  const priceStr = r.price || '??';
  
  lines.push(`\n📍 ${r.name}`);
  lines.push(`   ${r.cuisine || 'Unknown'} | ${priceStr} | ${r.neighborhood?.name || 'Unknown'}`);
  lines.push(`   Rating: ${r.rating || '?'}/10 ${stars.slice(0, 10)}`);
  
  if (r.vibes?.length) lines.push(`   Vibes: ${r.vibes.join(', ')}`);
  if (r.occasions?.length) lines.push(`   Good for: ${r.occasions.join(', ')}`);
  
  if (r.socialScore) {
    lines.push(`   📊 Social Score: ${r.socialScore.composite?.toFixed(1) || '?'}/5`);
  }
  
  if (r.lastVisited) {
    const days = daysSinceVisit(r.lastVisited);
    const visitStr = days < 14 ? ` ⚠️ (${days}d ago - recent!)` : ` (${days}d ago)`;
    lines.push(`   Last visit: ${r.lastVisited}${visitStr}`);
  }
  
  if (r.status === 'wishlist') {
    lines.push(`   📝 Wishlist: ${r.wishlistReason || 'Want to try'}`);
  }
  
  if (verbose) {
    if (r.notes) lines.push(`   Notes: ${r.notes}`);
    if (r.dishes?.length) lines.push(`   Dishes: ${r.dishes.map(d => d.name + (d.good ? ' ✓' : '')).join(', ')}`);
    if (r.visits?.length) {
      lines.push(`   Visit history:`);
      r.visits.slice(-3).forEach(v => {
        lines.push(`     - ${v.date}: ${v.with?.join(', ') || 'solo'}${v.notes ? ' - ' + v.notes : ''}`);
      });
    }
    if (r.socialScore?.breakdown) {
      lines.push(`   Review breakdown:`);
      const b = r.socialScore.breakdown;
      if (b.google) lines.push(`     Google: ${b.google.rating}/5 (${b.google.count} reviews)`);
      if (b.yelp) lines.push(`     Yelp: ${b.yelp.rating}/5 (${b.yelp.count} reviews)`);
      if (b.reddit) lines.push(`     Reddit: ${b.reddit.sentiment}`);
      if (b.tiktok) lines.push(`     TikTok: ${b.tiktok.hype}`);
    }
  }
  
  return lines.join('\n');
}

// ========== COMMANDS ==========

// ADD - Add or update a restaurant
async function cmdAdd(args) {
  const restaurants = loadRestaurants();
  
  // Parse arguments
  const name = args.name || args._[0];
  if (!name) {
    console.log('Usage: guide.js add <name> [options]');
    console.log('Options:');
    console.log('  --cuisine <type>      Cuisine type');
    console.log('  --neighborhood <area> Neighborhood');
    console.log('  --price <$-$$$$>      Price tier');
    console.log('  --rating <1-10>       Your rating');
    console.log('  --vibes <tags>        Comma-separated vibe tags');
    console.log('  --occasions <tags>    Comma-separated occasion tags');
    console.log('  --notes <text>        Personal notes');
    console.log('  --wishlist [reason]   Add to wishlist');
    console.log('  --visited <date>      Last visit date');
    console.log('  --with <people>       Who you went with');
    console.log('  --dish <name>         Dish you tried (can use multiple times)');
    console.log('  --enrich              Fetch social reviews');
    return;
  }
  
  // Find existing or create new
  let restaurant = restaurants.find(r => r.name.toLowerCase() === name.toLowerCase());
  const isUpdate = !!restaurant;
  
  if (!restaurant) {
    restaurant = {
      id: Date.now().toString(36),
      name: name,
      createdAt: new Date().toISOString(),
      status: 'visited',
      visits: [],
      dishes: []
    };
  }
  
  // Update fields
  if (args.cuisine) restaurant.cuisine = args.cuisine.toLowerCase();
  if (args.neighborhood) restaurant.neighborhood = normalizeNeighborhood(args.neighborhood);
  if (args.price) restaurant.price = args.price;
  if (args.rating) restaurant.rating = parseFloat(args.rating);
  if (args.notes) restaurant.notes = args.notes;
  
  if (args.vibes) {
    restaurant.vibes = args.vibes.split(',').map(v => v.trim().toLowerCase());
  }
  if (args.occasions) {
    restaurant.occasions = args.occasions.split(',').map(o => o.trim().toLowerCase());
  }
  
  // Wishlist mode
  if (args.wishlist !== undefined) {
    restaurant.status = 'wishlist';
    restaurant.wishlistReason = typeof args.wishlist === 'string' ? args.wishlist : '';
  }
  
  // Visit tracking
  if (args.visited || args.with) {
    const visit = {
      date: args.visited || new Date().toISOString().split('T')[0],
      with: args.with ? args.with.split(',').map(p => p.trim()) : null,
      notes: args.visitNotes || null
    };
    restaurant.visits = restaurant.visits || [];
    restaurant.visits.push(visit);
    restaurant.lastVisited = visit.date;
    restaurant.status = 'visited';
  }
  
  // Dish tracking
  if (args.dish) {
    const dishes = Array.isArray(args.dish) ? args.dish : [args.dish];
    restaurant.dishes = restaurant.dishes || [];
    dishes.forEach(d => {
      const [dishName, rating] = d.split(':');
      if (!restaurant.dishes.find(existing => existing.name.toLowerCase() === dishName.toLowerCase())) {
        restaurant.dishes.push({
          name: dishName.trim(),
          good: rating ? rating.toLowerCase().includes('good') : true,
          addedAt: new Date().toISOString()
        });
      }
    });
  }
  
  // Social enrichment
  if (args.enrich) {
    console.log(`\n🔍 Fetching social reviews for "${name}"...`);
    const { enrichRestaurant } = await import('./lib/social.js');
    restaurant = await enrichRestaurant(restaurant);
    console.log('✓ Social data updated');
  }
  
  restaurant.updatedAt = new Date().toISOString();
  
  // Save
  if (isUpdate) {
    const idx = restaurants.findIndex(r => r.id === restaurant.id);
    restaurants[idx] = restaurant;
  } else {
    restaurants.push(restaurant);
  }
  
  saveRestaurants(restaurants);
  console.log(`\n${isUpdate ? 'Updated' : 'Added'}: ${formatRestaurant(restaurant, true)}`);
}

// SEARCH - Filter restaurants
function cmdSearch(args) {
  let restaurants = loadRestaurants();
  
  // Apply filters
  if (args.cuisine) {
    const c = args.cuisine.toLowerCase();
    restaurants = restaurants.filter(r => r.cuisine?.toLowerCase().includes(c));
  }
  if (args.neighborhood || args.hood) {
    const n = normalizeNeighborhood(args.neighborhood || args.hood);
    restaurants = restaurants.filter(r => 
      r.neighborhood?.key === n.key || 
      r.neighborhood?.name?.toLowerCase().includes((args.neighborhood || args.hood).toLowerCase())
    );
  }
  if (args.price) {
    restaurants = restaurants.filter(r => r.price === args.price);
  }
  if (args.vibe) {
    const v = args.vibe.toLowerCase();
    restaurants = restaurants.filter(r => r.vibes?.some(vibe => vibe.includes(v)));
  }
  if (args.occasion) {
    const o = args.occasion.toLowerCase();
    restaurants = restaurants.filter(r => r.occasions?.some(occ => occ.includes(o)));
  }
  if (args.rating) {
    const minRating = parseFloat(args.rating);
    restaurants = restaurants.filter(r => (r.rating || 0) >= minRating);
  }
  if (args.visited !== undefined) {
    restaurants = restaurants.filter(r => r.status === 'visited');
  }
  if (args.wishlist !== undefined) {
    restaurants = restaurants.filter(r => r.status === 'wishlist');
  }
  
  // Sort
  const sortBy = args.sort || 'rating';
  if (sortBy === 'rating') {
    restaurants.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortBy === 'recent') {
    restaurants.sort((a, b) => {
      const dA = a.lastVisited ? new Date(a.lastVisited) : new Date(0);
      const dB = b.lastVisited ? new Date(b.lastVisited) : new Date(0);
      return dB - dA;
    });
  } else if (sortBy === 'social') {
    restaurants.sort((a, b) => (b.socialScore?.composite || 0) - (a.socialScore?.composite || 0));
  } else if (sortBy === 'distance') {
    restaurants.sort((a, b) => (a.neighborhood?.distance || 99) - (b.neighborhood?.distance || 99));
  }
  
  // Limit
  const limit = args.limit ? parseInt(args.limit) : 10;
  restaurants = restaurants.slice(0, limit);
  
  if (restaurants.length === 0) {
    console.log('\nNo restaurants found matching your criteria.');
    return;
  }
  
  console.log(`\n🍽️  Found ${restaurants.length} restaurants:`);
  restaurants.forEach(r => console.log(formatRestaurant(r, args.verbose)));
}

// RECOMMEND - Smart recommendation
function cmdRecommend(args) {
  let restaurants = loadRestaurants().filter(r => r.status !== 'wishlist');
  const people = loadPeople();
  
  const occasion = args.occasion || args.for;
  const withPeople = args.with ? args.with.split(',').map(p => p.trim().toLowerCase()) : [];
  
  // Filter by occasion
  if (occasion) {
    restaurants = restaurants.filter(r => r.occasions?.some(o => o.includes(occasion.toLowerCase())));
  }
  
  // Apply people preferences
  if (withPeople.length > 0) {
    withPeople.forEach(personName => {
      const person = people[personName];
      if (person) {
        // Apply cuisine preferences
        if (person.likes?.cuisines?.length) {
          restaurants = restaurants.filter(r => 
            person.likes.cuisines.some(c => r.cuisine?.toLowerCase().includes(c.toLowerCase()))
          );
        }
        // Apply dislikes
        if (person.dislikes?.cuisines?.length) {
          restaurants = restaurants.filter(r => 
            !person.dislikes.cuisines.some(c => r.cuisine?.toLowerCase().includes(c.toLowerCase()))
          );
        }
        // Apply dietary restrictions
        if (person.dietary?.length) {
          // Need vegetarian options
          if (person.dietary.includes('vegetarian')) {
            restaurants = restaurants.filter(r => 
              r.vibes?.includes('vegetarian') || 
              r.cuisine?.includes('vegetarian') ||
              r.notes?.toLowerCase().includes('vegetarian options')
            );
          }
        }
        // Price preference
        if (person.maxPrice) {
          const priceLevel = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
          const maxLevel = priceLevel[person.maxPrice] || 4;
          restaurants = restaurants.filter(r => (priceLevel[r.price] || 2) <= maxLevel);
        }
      }
    });
  }
  
  // Score restaurants
  restaurants = restaurants.map(r => {
    let score = 0;
    
    // JB's personal rating (40%)
    score += ((r.rating || 5) / 10) * 40;
    
    // Social score (30%)
    score += ((r.socialScore?.composite || 3) / 5) * 30;
    
    // Recency penalty (15%) - avoid recently visited
    const days = daysSinceVisit(r.lastVisited);
    if (days < 14) score -= 10; // Heavy penalty for < 2 weeks
    else if (days < 30) score -= 5;
    else score += 5; // Bonus for not visited recently
    
    // Occasion fit (15%)
    if (occasion && r.occasions?.includes(occasion.toLowerCase())) {
      score += 15;
    }
    
    return { ...r, recommendScore: score };
  });
  
  // Sort by recommendation score
  restaurants.sort((a, b) => b.recommendScore - a.recommendScore);
  
  // Apply distance filter if specified
  if (args.maxDistance) {
    const maxDist = parseInt(args.maxDistance);
    restaurants = restaurants.filter(r => (r.neighborhood?.distance || 0) <= maxDist);
  }
  
  const limit = args.limit ? parseInt(args.limit) : 5;
  restaurants = restaurants.slice(0, limit);
  
  if (restaurants.length === 0) {
    console.log('\nNo recommendations found. Try broadening your criteria.');
    return;
  }
  
  const header = withPeople.length > 0 
    ? `\n🎯 Top picks for ${occasion || 'dinner'} with ${withPeople.join(' & ')}:`
    : `\n🎯 Top picks for ${occasion || 'dinner'}:`;
  console.log(header);
  
  restaurants.forEach((r, i) => {
    console.log(`\n${i + 1}. ${formatRestaurant(r, false)}`);
    console.log(`   Recommendation Score: ${r.recommendScore.toFixed(1)}/100`);
  });
}

// WISHLIST - Manage want-to-try list
function cmdWishlist(args) {
  const restaurants = loadRestaurants();
  const wishlist = restaurants.filter(r => r.status === 'wishlist');
  
  if (args.add || args._[0]) {
    // Add to wishlist handled by add command
    const name = args.add || args._[0];
    const reason = args.reason || args._[1] || '';
    return cmdAdd({ _: [name], wishlist: reason });
  }
  
  if (args.remove) {
    const name = args.remove.toLowerCase();
    const idx = restaurants.findIndex(r => 
      r.status === 'wishlist' && r.name.toLowerCase().includes(name)
    );
    if (idx >= 0) {
      restaurants[idx].status = 'visited';
      restaurants[idx].updatedAt = new Date().toISOString();
      saveRestaurants(restaurants);
      console.log(`\n✓ Removed "${restaurants[idx].name}" from wishlist`);
    } else {
      console.log(`\n❌ No wishlist item found matching "${args.remove}"`);
    }
    return;
  }
  
  // List wishlist
  if (wishlist.length === 0) {
    console.log('\n📝 Wishlist is empty. Add restaurants with: guide.js add <name> --wishlist "reason"');
    return;
  }
  
  console.log(`\n📝 Wishlist (${wishlist.length} restaurants):`);
  wishlist.forEach(r => {
    console.log(`\n• ${r.name}`);
    if (r.cuisine) console.log(`  ${r.cuisine} | ${r.neighborhood?.name || 'Unknown'} | ${r.price || '?'}`);
    if (r.wishlistReason) console.log(`  Why: ${r.wishlistReason}`);
    if (r.socialScore) console.log(`  📊 Social: ${r.socialScore.composite?.toFixed(1)}/5`);
  });
}

// HISTORY - Show recent visits
function cmdHistory(args) {
  const restaurants = loadRestaurants()
    .filter(r => r.lastVisited)
    .sort((a, b) => new Date(b.lastVisited) - new Date(a.lastVisited));
  
  const limit = args.limit ? parseInt(args.limit) : 10;
  const recent = restaurants.slice(0, limit);
  
  if (recent.length === 0) {
    console.log('\n📅 No visit history. Track visits with: guide.js add <name> --visited 2026-02-28');
    return;
  }
  
  console.log(`\n📅 Recent visits:`);
  recent.forEach(r => {
    const days = daysSinceVisit(r.lastVisited);
    const warning = days < 14 ? ' ⚠️ recent!' : '';
    console.log(`\n• ${r.lastVisited}: ${r.name}${warning}`);
    if (r.visits?.length) {
      const lastVisit = r.visits[r.visits.length - 1];
      if (lastVisit.with) console.log(`  With: ${lastVisit.with.join(', ')}`);
      if (lastVisit.notes) console.log(`  Notes: ${lastVisit.notes}`);
    }
  });
}

// RANDOM - Pick a random spot
function cmdRandom(args) {
  let restaurants = loadRestaurants().filter(r => r.status !== 'wishlist');
  
  // Apply same filters as search
  if (args.cuisine) {
    restaurants = restaurants.filter(r => r.cuisine?.toLowerCase().includes(args.cuisine.toLowerCase()));
  }
  if (args.price) {
    restaurants = restaurants.filter(r => r.price === args.price);
  }
  if (args.vibe) {
    restaurants = restaurants.filter(r => r.vibes?.some(v => v.includes(args.vibe.toLowerCase())));
  }
  if (args.occasion) {
    restaurants = restaurants.filter(r => r.occasions?.some(o => o.includes(args.occasion.toLowerCase())));
  }
  
  // Anti-repeat: exclude recently visited
  const minDays = args.minDays ? parseInt(args.minDays) : 14;
  restaurants = restaurants.filter(r => daysSinceVisit(r.lastVisited) >= minDays);
  
  if (restaurants.length === 0) {
    console.log('\n🎲 No restaurants match your criteria. Try loosening filters.');
    return;
  }
  
  const pick = restaurants[Math.floor(Math.random() * restaurants.length)];
  console.log(`\n🎲 Random pick:${formatRestaurant(pick, true)}`);
}

// INFO - Full details on a restaurant
function cmdInfo(args) {
  const name = args.name || args._[0];
  if (!name) {
    console.log('Usage: guide.js info <restaurant name>');
    return;
  }
  
  const restaurants = loadRestaurants();
  const matches = restaurants.filter(r => 
    r.name.toLowerCase().includes(name.toLowerCase())
  );
  
  if (matches.length === 0) {
    console.log(`\n❌ No restaurant found matching "${name}"`);
    return;
  }
  
  matches.forEach(r => {
    console.log(formatRestaurant(r, true));
    
    // Full social breakdown
    if (r.socialScore?.breakdown) {
      console.log('\n   📊 Full Social Breakdown:');
      const b = r.socialScore.breakdown;
      Object.entries(b).forEach(([platform, data]) => {
        if (typeof data === 'object') {
          console.log(`     ${platform}: ${JSON.stringify(data)}`);
        } else {
          console.log(`     ${platform}: ${data}`);
        }
      });
      
      if (r.socialScore.themes) {
        console.log(`\n   Common themes: ${r.socialScore.themes}`);
      }
      
      if (r.socialScore.trending) {
        console.log(`   🔥 TRENDING - Recent hype on social media`);
      }
    }
  });
}

// PEOPLE - Manage people preferences
function cmdPeople(args) {
  const people = loadPeople();
  
  const name = args.name || args._[0];
  
  if (!name) {
    // List all people
    const names = Object.keys(people);
    if (names.length === 0) {
      console.log('\n👥 No people saved yet.');
      console.log('Add someone: guide.js people <name> --likes-cuisine italian,sushi');
      return;
    }
    
    console.log('\n👥 Saved people preferences:');
    names.forEach(n => {
      const p = people[n];
      console.log(`\n• ${n}`);
      if (p.likes?.cuisines) console.log(`  Likes: ${p.likes.cuisines.join(', ')}`);
      if (p.dislikes?.cuisines) console.log(`  Dislikes: ${p.dislikes.cuisines.join(', ')}`);
      if (p.dietary) console.log(`  Dietary: ${p.dietary.join(', ')}`);
      if (p.maxPrice) console.log(`  Max price: ${p.maxPrice}`);
      if (p.notes) console.log(`  Notes: ${p.notes}`);
    });
    return;
  }
  
  // Add/update person
  const key = name.toLowerCase();
  const person = people[key] || { name: name, likes: {}, dislikes: {} };
  
  if (args['likes-cuisine'] || args.likesCuisine) {
    person.likes = person.likes || {};
    person.likes.cuisines = (args['likes-cuisine'] || args.likesCuisine).split(',').map(c => c.trim());
  }
  if (args['dislikes-cuisine'] || args.dislikesCuisine) {
    person.dislikes = person.dislikes || {};
    person.dislikes.cuisines = (args['dislikes-cuisine'] || args.dislikesCuisine).split(',').map(c => c.trim());
  }
  if (args.dietary) {
    person.dietary = args.dietary.split(',').map(d => d.trim());
  }
  if (args.maxPrice) {
    person.maxPrice = args.maxPrice;
  }
  if (args.notes) {
    person.notes = args.notes;
  }
  
  people[key] = person;
  savePeople(people);
  console.log(`\n✓ Saved preferences for ${name}`);
}

// ENRICH - Fetch social data for restaurants
async function cmdEnrich(args) {
  const restaurants = loadRestaurants();
  const name = args.name || args._[0];
  
  if (!name && !args.all) {
    console.log('Usage: guide.js enrich <name> OR guide.js enrich --all');
    return;
  }
  
  const { enrichRestaurant } = await import('./lib/social.js');
  
  if (args.all) {
    console.log('\n🔍 Enriching all restaurants...');
    for (let i = 0; i < restaurants.length; i++) {
      if (!restaurants[i].socialScore || args.refresh) {
        console.log(`  Processing ${restaurants[i].name}...`);
        restaurants[i] = await enrichRestaurant(restaurants[i]);
        // Rate limiting
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    saveRestaurants(restaurants);
    console.log('✓ Done!');
    return;
  }
  
  const idx = restaurants.findIndex(r => r.name.toLowerCase().includes(name.toLowerCase()));
  if (idx < 0) {
    console.log(`\n❌ Restaurant not found: ${name}`);
    return;
  }
  
  console.log(`\n🔍 Fetching social data for ${restaurants[idx].name}...`);
  restaurants[idx] = await enrichRestaurant(restaurants[idx]);
  saveRestaurants(restaurants);
  console.log(formatRestaurant(restaurants[idx], true));
}

// STATS - Summary statistics
function cmdStats() {
  const restaurants = loadRestaurants();
  const visited = restaurants.filter(r => r.status !== 'wishlist');
  const wishlist = restaurants.filter(r => r.status === 'wishlist');
  
  console.log('\n📊 Food Guide Stats:');
  console.log(`   Total restaurants: ${restaurants.length}`);
  console.log(`   Visited: ${visited.length}`);
  console.log(`   Wishlist: ${wishlist.length}`);
  
  // Cuisine breakdown
  const cuisines = {};
  visited.forEach(r => {
    if (r.cuisine) cuisines[r.cuisine] = (cuisines[r.cuisine] || 0) + 1;
  });
  const topCuisines = Object.entries(cuisines).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topCuisines.length) {
    console.log(`\n   Top cuisines: ${topCuisines.map(([c, n]) => `${c} (${n})`).join(', ')}`);
  }
  
  // Neighborhood breakdown
  const hoods = {};
  visited.forEach(r => {
    if (r.neighborhood?.name) hoods[r.neighborhood.name] = (hoods[r.neighborhood.name] || 0) + 1;
  });
  const topHoods = Object.entries(hoods).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topHoods.length) {
    console.log(`   Top neighborhoods: ${topHoods.map(([h, n]) => `${h} (${n})`).join(', ')}`);
  }
  
  // Average rating
  const ratings = visited.filter(r => r.rating).map(r => r.rating);
  if (ratings.length) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    console.log(`   Average rating: ${avg.toFixed(1)}/10`);
  }
}

// EXPORT - Export for Telegram/external use
function cmdExport(args) {
  const restaurants = loadRestaurants();
  const format = args.format || 'text';
  
  if (format === 'json') {
    console.log(JSON.stringify(restaurants, null, 2));
    return;
  }
  
  // Text format for Telegram
  let output = '🍽️ JB\'s Food Guide\n\n';
  
  const byRating = [...restaurants].filter(r => r.status !== 'wishlist')
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  
  output += '⭐ TOP RATED:\n';
  byRating.slice(0, 10).forEach((r, i) => {
    output += `${i + 1}. ${r.name} (${r.rating}/10) - ${r.cuisine}, ${r.neighborhood?.name || '?'}\n`;
  });
  
  const wishlist = restaurants.filter(r => r.status === 'wishlist');
  if (wishlist.length) {
    output += '\n📝 WISHLIST:\n';
    wishlist.forEach(r => {
      output += `• ${r.name} - ${r.wishlistReason || 'Want to try'}\n`;
    });
  }
  
  console.log(output);
}

// Parse CLI args
function parseArgs(argv) {
  const args = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = true;
        i++;
      }
    } else if (arg.startsWith('-')) {
      args[arg.slice(1)] = true;
      i++;
    } else {
      args._.push(arg);
      i++;
    }
  }
  return args;
}

// Main
async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = parseArgs(argv.slice(1));
  
  switch (command) {
    case 'add':
      await cmdAdd(args);
      break;
    case 'search':
    case 's':
      cmdSearch(args);
      break;
    case 'recommend':
    case 'rec':
      cmdRecommend(args);
      break;
    case 'wishlist':
    case 'wl':
      cmdWishlist(args);
      break;
    case 'history':
    case 'h':
      cmdHistory(args);
      break;
    case 'random':
    case 'r':
      cmdRandom(args);
      break;
    case 'info':
    case 'i':
      cmdInfo(args);
      break;
    case 'people':
    case 'p':
      cmdPeople(args);
      break;
    case 'enrich':
      await cmdEnrich(args);
      break;
    case 'stats':
      cmdStats();
      break;
    case 'export':
      cmdExport(args);
      break;
    default:
      console.log(`
🍽️  Food Guide - Personal Restaurant Database

Commands:
  add <name>       Add or update a restaurant
  search           Filter restaurants by criteria
  recommend        Get smart recommendations
  wishlist         Manage want-to-try list
  history          Show recent visits
  random           Pick a random spot
  info <name>      Full details on a restaurant
  people           Manage people preferences
  enrich           Fetch social review data
  stats            Summary statistics
  export           Export data

Examples:
  guide.js add OSTE --cuisine italian --price $$ --rating 8 --visited 2026-02-28 --with mom,sister
  guide.js search --cuisine italian --price $$ --vibe cozy
  guide.js recommend --occasion date --with parri
  guide.js wishlist --add "Bestia" --reason "Chris recommended"
  guide.js random --cuisine sushi --minDays 14
  guide.js people parri --likes-cuisine italian,sushi --dislikes-cuisine chinese
  guide.js enrich OSTE

Tips:
  • Track visits with --visited and --with to build history
  • Add people preferences for smarter recommendations
  • Use --enrich to fetch Google/Yelp/Reddit reviews
  • Wishlist items won't appear in recommendations until visited
      `);
  }
}

main().catch(console.error);
