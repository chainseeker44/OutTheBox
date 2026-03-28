/**
 * Calendar Reminder Check
 * Checks for events starting in ~10 minutes and outputs reminder text
 * Run via cron every 5 minutes
 */

const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const REMINDED_FILE = __dirname + '/reminded.json';

// Load already-reminded events
function getReminded() {
  if (!fs.existsSync(REMINDED_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(REMINDED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveReminded(reminded) {
  // Clean old entries (>24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const key of Object.keys(reminded)) {
    if (reminded[key] < cutoff) delete reminded[key];
  }
  fs.writeFileSync(REMINDED_FILE, JSON.stringify(reminded, null, 2));
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

function fetchEvents(accessToken, timeMin, timeMax) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const req = https.request({
      hostname: 'www.googleapis.com',
      path: `/calendar/v3/calendars/primary/events?${params}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.error) reject(new Error(json.error.message));
        else resolve(json.items || []);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getEventsFromToken(tokenPath, label, timeMin, timeMax) {
  if (!fs.existsSync(tokenPath)) return [];
  
  let token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  
  if (!token.expiry_date || Date.now() >= token.expiry_date - 60000) {
    try {
      token = await refreshToken(token);
      fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
    } catch (e) {
      return [];
    }
  }
  
  const events = await fetchEvents(token.access_token, timeMin, timeMax);
  return events.map(e => ({ ...e, _calendar: label }));
}

async function checkReminders() {
  const now = new Date();
  // Check for events starting in 8-12 minutes (window to catch ~10 min mark)
  const windowStart = new Date(now.getTime() + 8 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 12 * 60 * 1000);
  
  const tokenFiles = [
    { path: __dirname + '/token.json', label: 'Personal' },
    { path: __dirname + '/token-work.json', label: 'Movement' },
  ];
  
  const allEvents = [];
  for (const { path, label } of tokenFiles) {
    try {
      const events = await getEventsFromToken(path, label, windowStart, windowEnd);
      allEvents.push(...events);
    } catch (e) {
      // Skip
    }
  }
  
  if (allEvents.length === 0) {
    console.log('NO_REMINDER');
    return;
  }
  
  // Check which ones we haven't reminded yet
  const reminded = getReminded();
  const toRemind = [];
  
  for (const event of allEvents) {
    const eventKey = `${event.id}|${event.start.dateTime}`;
    if (!reminded[eventKey]) {
      toRemind.push(event);
      reminded[eventKey] = Date.now();
    }
  }
  
  saveReminded(reminded);
  
  if (toRemind.length === 0) {
    console.log('NO_REMINDER');
    return;
  }
  
  // Output reminder
  for (const event of toRemind) {
    const start = new Date(event.start.dateTime);
    const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const mins = Math.round((start - now) / 60000);
    
    console.log(`REMINDER: ⏰ ${event.summary} [${event._calendar}] starts in ${mins} minutes (${timeStr})`);
    if (event.hangoutLink) {
      console.log(`LINK: ${event.hangoutLink}`);
    } else if (event.location && event.location.includes('meet.google.com')) {
      console.log(`LINK: ${event.location}`);
    }
  }
}

checkReminders().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
