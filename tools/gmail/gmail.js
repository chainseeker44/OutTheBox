#!/usr/bin/env node
/**
 * Gmail CLI — Read-only Gmail access via Google API
 * 
 * Setup:
 *   1. Create OAuth credentials at console.cloud.google.com
 *   2. Download credentials.json to this directory
 *   3. Run: node gmail.js auth (follow browser flow)
 *   4. Token saved to token.json
 * 
 * Usage:
 *   node gmail.js recent [count]         — List recent emails
 *   node gmail.js read <message_id>      — Read a specific email
 *   node gmail.js search <query>         — Search emails
 *   node gmail.js attachments <msg_id>   — List attachments
 *   node gmail.js download <msg_id> <att_id> <filename>
 * 
 * Multiple accounts:
 *   Add --work, --secondary flags and map them in TOKEN_FILES below.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const CREDS_PATH = path.join(__dirname, 'credentials.json');

// Map account flags to token files — add your accounts here
const TOKEN_FILES = {
  personal: 'token.json',
  // work: 'token-work.json',
};

function getTokenPath(account) {
  const file = TOKEN_FILES[account] || 'token.json';
  return path.join(__dirname, file);
}

async function authorize(account = 'personal') {
  const creds = JSON.parse(fs.readFileSync(CREDS_PATH));
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  const tokenPath = getTokenPath(account);
  if (fs.existsSync(tokenPath)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath)));
    return oAuth2Client;
  }
  
  console.error(`No token found at ${tokenPath}. Run: node gmail.js auth`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'recent';
  
  // Detect account flag
  let account = 'personal';
  for (const [key] of Object.entries(TOKEN_FILES)) {
    if (args.includes(`--${key}`)) account = key;
  }
  
  const auth = await authorize(account);
  const gmail = google.gmail({ version: 'v1', auth });
  
  switch (command) {
    case 'recent': {
      const count = parseInt(args[1]) || 10;
      const res = await gmail.users.messages.list({ userId: 'me', maxResults: count });
      const messages = res.data.messages || [];
      for (const msg of messages) {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
        const headers = full.data.payload.headers;
        const subj = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        console.log(`[${msg.id}] ${date} | ${from} | ${subj}`);
      }
      break;
    }
    case 'read': {
      const msgId = args[1];
      if (!msgId) { console.log('Usage: gmail.js read <message_id>'); break; }
      const res = await gmail.users.messages.get({ userId: 'me', id: msgId });
      const payload = res.data.payload;
      const body = payload.body?.data || payload.parts?.find(p => p.mimeType === 'text/plain')?.body?.data || '';
      console.log(Buffer.from(body, 'base64').toString('utf8'));
      break;
    }
    case 'search': {
      const query = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
      const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 20 });
      const messages = res.data.messages || [];
      console.log(`Found ${messages.length} results for: ${query}`);
      for (const msg of messages) {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
        const headers = full.data.payload.headers;
        const subj = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        console.log(`[${msg.id}] ${subj}`);
      }
      break;
    }
    default:
      console.log('Commands: recent [count] | read <id> | search <query>');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
