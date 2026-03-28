/**
 * Google Calendar OAuth - Read Only
 * Run this once to authorize, then use calendar.js to fetch events
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');
const { exec } = require('child_process');

const config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const TOKEN_PATH = __dirname + '/token.json';

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(config.client_id)}` +
  `&redirect_uri=${encodeURIComponent(config.redirect_uri)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(config.scope)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('Opening browser for authorization...');
console.log('(Read-only calendar access only)\n');

// Open browser
const openCmd = process.platform === 'darwin' ? 'open' : 
                process.platform === 'win32' ? 'start' : 'xdg-open';
exec(`${openCmd} "${authUrl}"`);

// Start local server to catch the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  
  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    
    if (code) {
      try {
        const token = await exchangeCodeForToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Authorization successful!</h1><p>You can close this window. Calendar read-only access granted.</p>');
        
        console.log('✅ Token saved to token.json');
        console.log('Calendar access configured (read-only)');
        
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>❌ Error</h1><pre>${err.message}</pre>`);
        console.error('Error:', err.message);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>❌ No authorization code received</h1>');
    }
  }
});

server.listen(3333, () => {
  console.log('Waiting for authorization callback on http://localhost:3333/callback ...');
});

function exchangeCodeForToken(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      code,
      client_id: config.client_id,
      client_secret: config.client_secret,
      redirect_uri: config.redirect_uri,
      grant_type: 'authorization_code'
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
          // Add expiry_date for proper refresh handling
          if (json.expires_in) {
            json.expiry_date = Date.now() + (json.expires_in * 1000);
          }
          resolve(json);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}
