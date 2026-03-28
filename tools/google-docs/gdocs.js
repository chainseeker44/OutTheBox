#!/usr/bin/env node
/**
 * Google Docs & Sheets CLI Tool
 * Usage:
 *   node gdocs.js docs list                          - List recent docs
 *   node gdocs.js docs create "Title"                - Create new doc
 *   node gdocs.js docs read <docId>                  - Read doc content
 *   node gdocs.js docs write <docId> "content"       - Append to doc
 *   node gdocs.js docs replace <docId> "old" "new"   - Find & replace in doc
 *   node gdocs.js docs insert <docId> <index> "text" - Insert at position
 *   node gdocs.js sheets list                        - List recent sheets
 *   node gdocs.js sheets create "Title"              - Create new sheet
 *   node gdocs.js sheets read <sheetId> [range]      - Read sheet data
 *   node gdocs.js sheets write <sheetId> <range> <json> - Write to sheet
 *   node gdocs.js sheets append <sheetId> <range> <json> - Append rows
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const TOKEN_PATH = path.join(__dirname, 'token.json');

// ── Token Management ──

function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('❌ No token found. Run: node auth.js');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

function refreshToken(token) {
  return new Promise((resolve, reject) => {
    const postData = [
      `client_id=${encodeURIComponent(CONFIG.client_id)}`,
      `client_secret=${encodeURIComponent(CONFIG.client_secret)}`,
      `refresh_token=${encodeURIComponent(token.refresh_token)}`,
      `grant_type=refresh_token`
    ].join('&');

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return reject(new Error(data.error_description || data.error));
          token.access_token = data.access_token;
          token.obtained_at = Date.now();
          if (data.refresh_token) token.refresh_token = data.refresh_token;
          saveToken(token);
          resolve(token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getValidToken() {
  let token = loadToken();
  const age = Date.now() - (token.obtained_at || 0);
  const expires = (token.expires_in || 3600) * 1000;
  if (age > expires - 60000) {
    token = await refreshToken(token);
  }
  return token;
}

// ── API Helpers ──

function apiRequest(hostname, path, method, token, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${token.access_token}`,
      'Content-Type': 'application/json'
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request({ hostname, path, method, headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const errMsg = parsed.error?.message || parsed.error || JSON.stringify(parsed);
            return reject(new Error(`API ${res.statusCode}: ${errMsg}`));
          }
          resolve(parsed);
        } catch (e) {
          if (res.statusCode >= 400) return reject(new Error(`API ${res.statusCode}: ${data}`));
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function docsApi(path, method = 'GET', body = null, token) {
  return apiRequest('docs.googleapis.com', path, method, token, body);
}

function sheetsApi(path, method = 'GET', body = null, token) {
  return apiRequest('sheets.googleapis.com', path, method, token, body);
}

function driveApi(path, method = 'GET', body = null, token) {
  return apiRequest('www.googleapis.com', path, method, token, body);
}

// ── Docs Commands ──

async function docsList(token) {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.document'");
  const res = await driveApi(
    `/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=20&fields=files(id,name,modifiedTime,webViewLink)`,
    'GET', null, token
  );
  if (!res.files?.length) { console.log('No documents found.'); return; }
  for (const f of res.files) {
    const date = new Date(f.modifiedTime).toLocaleDateString();
    console.log(`${f.id}  ${date}  ${f.name}`);
    console.log(`  ${f.webViewLink}`);
  }
}

async function docsCreate(title, token) {
  const res = await docsApi('/v1/documents', 'POST', { title }, token);
  console.log(`✅ Created: ${res.title}`);
  console.log(`   ID: ${res.documentId}`);
  console.log(`   URL: https://docs.google.com/document/d/${res.documentId}/edit`);
  return res;
}

async function docsRead(docId, token) {
  const res = await docsApi(`/v1/documents/${docId}`, 'GET', null, token);
  let text = '';
  if (res.body?.content) {
    for (const el of res.body.content) {
      if (el.paragraph?.elements) {
        for (const e of el.paragraph.elements) {
          if (e.textRun?.content) text += e.textRun.content;
        }
      } else if (el.table) {
        for (const row of el.table.tableRows || []) {
          const cells = [];
          for (const cell of row.tableCells || []) {
            let cellText = '';
            for (const p of cell.content || []) {
              if (p.paragraph?.elements) {
                for (const e of p.paragraph.elements) {
                  if (e.textRun?.content) cellText += e.textRun.content.trim();
                }
              }
            }
            cells.push(cellText);
          }
          text += cells.join('\t') + '\n';
        }
      }
    }
  }
  console.log(`# ${res.title}\n`);
  console.log(text);
  return { title: res.title, text, raw: res };
}

async function docsWrite(docId, content, token) {
  // Get current doc to find end index
  const doc = await docsApi(`/v1/documents/${docId}`, 'GET', null, token);
  const endIndex = doc.body.content[doc.body.content.length - 1].endIndex - 1;

  const requests = [{
    insertText: {
      location: { index: endIndex },
      text: content
    }
  }];

  await docsApi(`/v1/documents/${docId}:batchUpdate`, 'POST', { requests }, token);
  console.log(`✅ Appended ${content.length} chars to doc`);
}

async function docsReplace(docId, oldText, newText, token) {
  const requests = [{
    replaceAllText: {
      containsText: { text: oldText, matchCase: true },
      replaceText: newText
    }
  }];

  const res = await docsApi(`/v1/documents/${docId}:batchUpdate`, 'POST', { requests }, token);
  const count = res.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  console.log(`✅ Replaced ${count} occurrence(s)`);
}

async function docsInsert(docId, index, text, token) {
  const requests = [{
    insertText: {
      location: { index: parseInt(index) },
      text: text
    }
  }];

  await docsApi(`/v1/documents/${docId}:batchUpdate`, 'POST', { requests }, token);
  console.log(`✅ Inserted ${text.length} chars at index ${index}`);
}

// ── Sheets Commands ──

async function sheetsList(token) {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet'");
  const res = await driveApi(
    `/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=20&fields=files(id,name,modifiedTime,webViewLink)`,
    'GET', null, token
  );
  if (!res.files?.length) { console.log('No spreadsheets found.'); return; }
  for (const f of res.files) {
    const date = new Date(f.modifiedTime).toLocaleDateString();
    console.log(`${f.id}  ${date}  ${f.name}`);
    console.log(`  ${f.webViewLink}`);
  }
}

async function sheetsCreate(title, token) {
  const res = await sheetsApi('/v4/spreadsheets', 'POST', {
    properties: { title }
  }, token);
  console.log(`✅ Created: ${res.properties.title}`);
  console.log(`   ID: ${res.spreadsheetId}`);
  console.log(`   URL: ${res.spreadsheetUrl}`);
  return res;
}

async function sheetsRead(sheetId, range, token) {
  range = range || 'Sheet1';
  const encodedRange = encodeURIComponent(range);
  const res = await sheetsApi(
    `/v4/spreadsheets/${sheetId}/values/${encodedRange}`,
    'GET', null, token
  );
  if (!res.values?.length) { console.log('No data found.'); return; }
  // Print as TSV
  for (const row of res.values) {
    console.log(row.join('\t'));
  }
  return res;
}

async function sheetsWrite(sheetId, range, data, token) {
  const values = typeof data === 'string' ? JSON.parse(data) : data;
  const encodedRange = encodeURIComponent(range);
  const res = await sheetsApi(
    `/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    'PUT',
    { values },
    token
  );
  console.log(`✅ Updated ${res.updatedCells} cells in ${res.updatedRange}`);
}

async function sheetsAppend(sheetId, range, data, token) {
  const values = typeof data === 'string' ? JSON.parse(data) : data;
  const encodedRange = encodeURIComponent(range);
  const res = await sheetsApi(
    `/v4/spreadsheets/${sheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    'POST',
    { values },
    token
  );
  console.log(`✅ Appended ${res.updates?.updatedRows || 0} rows`);
}

// ── CLI Router ──

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(`Usage: node gdocs.js <docs|sheets> <command> [args...]
    
Docs:
  list                          List recent documents
  create "Title"                Create new document
  read <docId>                  Read document content
  write <docId> "content"       Append text to document
  replace <docId> "old" "new"   Find & replace text
  insert <docId> <index> "text" Insert at position

Sheets:
  list                          List recent spreadsheets
  create "Title"                Create new spreadsheet
  read <sheetId> [range]        Read data (default: Sheet1)
  write <sheetId> <range> <json> Write data (JSON 2D array)
  append <sheetId> <range> <json> Append rows`);
    process.exit(1);
  }

  const token = await getValidToken();
  const [service, command, ...rest] = args;

  try {
    if (service === 'docs') {
      switch (command) {
        case 'list': await docsList(token); break;
        case 'create': await docsCreate(rest[0] || 'Untitled', token); break;
        case 'read': await docsRead(rest[0], token); break;
        case 'write': await docsWrite(rest[0], rest[1], token); break;
        case 'replace': await docsReplace(rest[0], rest[1], rest[2], token); break;
        case 'insert': await docsInsert(rest[0], rest[1], rest[2], token); break;
        default: console.error(`Unknown docs command: ${command}`); process.exit(1);
      }
    } else if (service === 'sheets') {
      switch (command) {
        case 'list': await sheetsList(token); break;
        case 'create': await sheetsCreate(rest[0] || 'Untitled', token); break;
        case 'read': await sheetsRead(rest[0], rest[1], token); break;
        case 'write': await sheetsWrite(rest[0], rest[1], rest[2], token); break;
        case 'append': await sheetsAppend(rest[0], rest[1], rest[2], token); break;
        default: console.error(`Unknown sheets command: ${command}`); process.exit(1);
      }
    } else {
      console.error(`Unknown service: ${service}. Use 'docs' or 'sheets'`);
      process.exit(1);
    }
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

main();
