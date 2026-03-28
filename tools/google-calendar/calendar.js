/**
 * Google Calendar Reader - Read Only
 * Fetches upcoming events from your calendar
 */

const https = require('https');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));

// Determine which token file to use based on args
function getTokenPath() {
  const args = process.argv.slice(2);
  if (args.includes('--work')) return __dirname + '/token-work.json';
  if (args.includes('--josh')) return __dirname + '/token-josh.json';
  return __dirname + '/token.json';
}

async function getAccessToken() {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Not authorized. Token file not found: ${tokenPath}`);
  }
  
  let token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  
  // Check if token needs refresh (no expiry_date = always refresh first time)
  if (!token.expiry_date || Date.now() >= token.expiry_date - 60000) {
    token = await refreshToken(token);
    fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
  }
  
  return token.access_token;
}

function refreshToken(token) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    }).toString();

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.error) {
          reject(new Error(json.error_description || json.error));
        } else {
          resolve({
            ...token,
            access_token: json.access_token,
            expiry_date: Date.now() + (json.expires_in * 1000)
          });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function fetchCalendarEvents(accessToken, options = {}) {
  return new Promise((resolve, reject) => {
    const timeMin = options.timeMin || new Date().toISOString();
    const timeMax = options.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const maxResults = options.maxResults || 20;
    
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const req = https.request({
      hostname: 'www.googleapis.com',
      path: `/calendar/v3/calendars/primary/events?${params}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.error) {
          reject(new Error(json.error.message));
        } else {
          resolve(json.items || []);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getUpcomingEvents(days = 7) {
  const accessToken = await getAccessToken();
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return fetchCalendarEvents(accessToken, { timeMax });
}

async function getTodayEvents() {
  const accessToken = await getAccessToken();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return fetchCalendarEvents(accessToken, {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString()
  });
}

// Fetch events from a specific token file
async function getEventsFromToken(tokenPath, days, label) {
  if (!fs.existsSync(tokenPath)) return [];
  
  let token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  
  // Refresh if needed
  if (!token.expiry_date || Date.now() >= token.expiry_date - 60000) {
    try {
      token = await refreshToken(token);
      fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
    } catch (e) {
      console.error(`Warning: Could not refresh ${label} token`);
      return [];
    }
  }
  
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const events = await fetchCalendarEvents(token.access_token, { timeMax });
  return events.map(e => ({ ...e, _calendar: label }));
}

// Get combined events from all calendars
async function getAllCalendarEvents(days = 7) {
  const tokenFiles = [
    { path: __dirname + '/token.json', label: 'Personal' },
    { path: __dirname + '/token-work.json', label: 'Movement' },
  ];
  
  const allEvents = [];
  for (const { path, label } of tokenFiles) {
    try {
      const events = await getEventsFromToken(path, days, label);
      allEvents.push(...events);
    } catch (e) {
      // Skip failed calendars silently
    }
  }
  
  // Sort by start time and dedupe by summary+time
  allEvents.sort((a, b) => {
    const aTime = new Date(a.start.dateTime || a.start.date);
    const bTime = new Date(b.start.dateTime || b.start.date);
    return aTime - bTime;
  });
  
  // Dedupe events with same name and start time
  const seen = new Set();
  return allEvents.filter(e => {
    const key = `${e.summary}|${e.start.dateTime || e.start.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const days = args.find(a => !a.startsWith('--')) || 7;
  const daysNum = parseInt(days);
  
  // Check for single-calendar flags
  const useWork = args.includes('--work');
  const useJosh = args.includes('--josh');
  const usePersonal = args.includes('--personal');
  
  let eventsPromise;
  if (useWork || useJosh || usePersonal) {
    // Single calendar mode
    eventsPromise = getUpcomingEvents(daysNum);
  } else {
    // Combined mode (default)
    eventsPromise = getAllCalendarEvents(daysNum);
  }
  
  eventsPromise
    .then(events => {
      if (events.length === 0) {
        console.log('No upcoming events found.');
      } else {
        const mode = (useWork || useJosh || usePersonal) ? '' : ' (all calendars)';
        console.log(`Upcoming events (next ${daysNum} days)${mode}:\n`);
        const now = new Date();
        events.forEach(event => {
          const start = event.start.dateTime || event.start.date;
          const end = event.end.dateTime || event.end.date;
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          // Guard against invalid dates
          if (isNaN(startDate.getTime())) {
            console.log(`• [Invalid Date] — ${event.summary}`);
            return;
          }
          
          const cal = event._calendar ? ` [${event._calendar}]` : '';
          
          // Check if this is a multi-day event that started in the past
          const isMultiDay = (endDate - startDate) > 24 * 60 * 60 * 1000;
          const startedInPast = startDate < now;
          
          if (isMultiDay && startedInPast) {
            // Show as ongoing with end date
            const endStr = endDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
            console.log(`• [ONGOING until ${endStr}] — ${event.summary}${cal}`);
          } else {
            const time = startDate.toLocaleString();
            console.log(`• ${time} — ${event.summary}${cal}`);
          }
          if (event.location) console.log(`  📍 ${event.location}`);
        });
      }
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { getUpcomingEvents, getTodayEvents, getAccessToken };
