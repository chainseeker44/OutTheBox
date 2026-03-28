/**
 * Google Docs/Sheets OAuth - Read & Write
 * Run once to authorize YOUR_GOOGLE_ACCOUNT@gmail.com, then use gdocs.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');

const config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const TOKEN_PATH = __dirname + '/token.json';

const scopes = config.scopes.join(' ');

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(config.client_id)}` +
  `&redirect_uri=${encodeURIComponent(config.redirect_uri)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(scopes)}` +
  `&access_type=offline` +
  `&prompt=consent` +
  `&login_hint=YOUR_GOOGLE_ACCOUNT@gmail.com`;

console.log('Opening browser for Google Docs/Sheets authorization...');
console.log('Account: YOUR_GOOGLE_ACCOUNT@gmail.com');
console.log('Scopes: Docs (read/write), Sheets (read/write), Drive (file-level)\n');

// Start local callback server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  if (!url.pathname.startsWith('/callback')) return;

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400);
    res.end('No authorization code received');
    return;
  }

  // Exchange code for tokens
  const postData = [
    `code=${encodeURIComponent(code)}`,
    `client_id=${encodeURIComponent(config.client_id)}`,
    `client_secret=${encodeURIComponent(config.client_secret)}`,
    `redirect_uri=${encodeURIComponent(config.redirect_uri)}`,
    `grant_type=authorization_code`
  ].join('&');

  const tokenReq = https.request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (tokenRes) => {
    let body = '';
    tokenRes.on('data', d => body += d);
    tokenRes.on('end', () => {
      try {
        const tokens = JSON.parse(body);
        if (tokens.error) {
          console.error('Token error:', tokens.error, tokens.error_description);
          res.writeHead(500);
          res.end('Token exchange failed: ' + tokens.error_description);
          server.close();
          return;
        }
        tokens.obtained_at = Date.now();
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log('✅ Token saved to', TOKEN_PATH);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Authorized!</h1><p>Google Docs/Sheets access granted for YOUR_GOOGLE_ACCOUNT@gmail.com. You can close this tab.</p>');
      } catch (e) {
        console.error('Parse error:', e);
        res.writeHead(500);
        res.end('Failed to parse token response');
      }
      server.close();
    });
  });

  tokenReq.on('error', (e) => {
    console.error('Token request error:', e);
    res.writeHead(500);
    res.end('Token request failed');
    server.close();
  });

  tokenReq.write(postData);
  tokenReq.end();
});

server.listen(3333, () => {
  console.log('Listening on http://localhost:3333/callback ...');
  exec(`open "${authUrl}"`);
});
