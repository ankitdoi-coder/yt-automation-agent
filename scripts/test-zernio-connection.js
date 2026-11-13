/**
 * Zernio Account & Connection Diagnostics
 * Tests ZERNIO_API_KEY and lists connected platforms (Facebook, Instagram, etc.)
 * 
 * Usage:
 *   node scripts/test-zernio-connection.js
 */

require('dotenv').config();
const axios = require('axios');

async function testConnection() {
  const apiKey = String(process.env.ZERNIO_API_KEY || '').trim();
  const baseUrl = (process.env.ZERNIO_BASE_URL || 'https://zernio.com/api/v1').replace(/\/+$/, '');

  console.log('====================================================');
  console.log('🔍 ZERNIO CONNECTION & ACCOUNT DIAGNOSTICS');
  console.log('====================================================');

  if (!apiKey) {
    console.log('❌ ZERNIO_API_KEY is not set in local .env');
    console.log('👉 Please add ZERNIO_API_KEY=your_key to your .env file or pass it when running.');
    console.log('   Example: $env:ZERNIO_API_KEY="your_key"; node scripts/test-zernio-connection.js\n');
    return;
  }

  console.log(`🔑 API Key detected: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
  console.log(`🌐 Base URL: ${baseUrl}`);
  console.log('📡 Contacting Zernio API for connected accounts...\n');

  try {
    const res = await axios.get(`${baseUrl}/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    const accounts = Array.isArray(res.data?.accounts)
      ? res.data.accounts
      : (Array.isArray(res.data) ? res.data : []);

    if (accounts.length === 0) {
      console.log('⚠️ No connected accounts found on Zernio.');
      console.log('👉 Go to https://zernio.com -> Connections and connect your Facebook Page & Instagram Account.');
      return;
    }

    console.log(`✅ Successfully connected! Found ${accounts.length} account(s):\n`);
    accounts.forEach((acc, i) => {
      const platform = acc.platform || acc.type || 'unknown';
      const id = acc._id || acc.id || 'N/A';
      const name = acc.displayName || acc.name || acc.username || 'N/A';
      const status = acc.status || 'active';
      console.log(`  [${i + 1}] Platform: ${platform.toUpperCase()}`);
      console.log(`      Name:     ${name}`);
      console.log(`      ID:       ${id}`);
      console.log(`      Status:   ${status}`);
      console.log('----------------------------------------------------');
    });

    const fb = accounts.find(a => String(a.platform || '').toLowerCase() === 'facebook');
    const ig = accounts.find(a => String(a.platform || '').toLowerCase() === 'instagram');

    console.log('\n📋 Platform Summary for Automation:');
    console.log(`  • Facebook Page:       ${fb ? `✅ Connected (${fb.displayName || fb.name || fb._id})` : '❌ Not connected'}`);
    console.log(`  • Instagram Account:   ${ig ? `✅ Connected (${ig.displayName || ig.username || ig.name || ig._id})` : '❌ Not connected'}`);

  } catch (err) {
    console.error('❌ Failed to fetch accounts from Zernio:');
    if (err.response) {
      console.error(`  Status: ${err.response.status}`);
      console.error(`  Data:   ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`  Error:  ${err.message}`);
    }
  }
}

testConnection();
