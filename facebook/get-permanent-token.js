/**
 * Helper to exchange short-lived token for a NEVER-EXPIRING Page Access Token
 * 
 * Usage:
 *   node facebook/get-permanent-token.js <USER_TOKEN> <APP_SECRET>
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FB_APP_ID || '4590515007900625';
const PAGE_ID = process.env.FB_PAGE_ID || '1289712677569663';

async function generatePermanentToken() {
  const args = process.argv.slice(2);
  const userToken = args[0] || process.env.TEMP_USER_TOKEN;
  const appSecret = args[1] || process.env.FB_APP_SECRET;

  if (!userToken || !appSecret) {
    console.log('\n❌ Missing required parameters:');
    console.log('Usage: node facebook/get-permanent-token.js <SHORT_USER_TOKEN> <APP_SECRET>');
    console.log('\nSteps to get them:');
    console.log('1. Go to https://developers.facebook.com/apps/' + APP_ID + '/settings/basic/ to get APP_SECRET');
    console.log('2. Go to https://developers.facebook.com/tools/explorer/ to get a fresh USER_TOKEN with pages_manage_posts');
    process.exit(1);
  }

  console.log('🔄 Step 1: Exchanging for 60-Day Long-Lived User Token...');
  const exchangeRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: appSecret,
      fb_exchange_token: userToken,
    },
  });

  const longLivedUserToken = exchangeRes.data.access_token;
  console.log('✅ Long-Lived User Token generated!');

  console.log('\n🔄 Step 2: Fetching Permanent (Never-Expiring) Page Access Token...');
  const accountsRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
    params: {
      access_token: longLivedUserToken,
    },
  });

  const pages = accountsRes.data.data || [];
  const targetPage = pages.find(p => p.id === PAGE_ID) || pages[0];

  if (!targetPage) {
    console.error('❌ Could not find Page in accounts:', pages);
    process.exit(1);
  }

  const permanentPageToken = targetPage.access_token;
  console.log(`\n🎉 SUCCESS! Permanent Page Token for "${targetPage.name}" (ID: ${targetPage.id})`);
  console.log('----------------------------------------------------');
  console.log(permanentPageToken);
  console.log('----------------------------------------------------');

  // Verify expiration
  const debugRes = await axios.get('https://graph.facebook.com/debug_token', {
    params: {
      input_token: permanentPageToken,
      access_token: permanentPageToken,
    },
  });

  const expiresAt = debugRes.data?.data?.expires_at;
  console.log(`Token expires_at: ${expiresAt} (${expiresAt === 0 ? 'NEVER EXPIRES ✅' : new Date(expiresAt * 1000).toLocaleString()})`);

  // Update .env
  const envPath = path.resolve(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('FB_PAGE_ACCESS_TOKEN=')) {
    envContent = envContent.replace(/FB_PAGE_ACCESS_TOKEN=.*/, `FB_PAGE_ACCESS_TOKEN=${permanentPageToken}`);
  } else {
    envContent += `\nFB_PAGE_ACCESS_TOKEN=${permanentPageToken}\n`;
  }
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Updated .env with permanent FB_PAGE_ACCESS_TOKEN!');
}

generatePermanentToken().catch(err => {
  console.error('\n❌ Error generating permanent token:', err.response?.data || err.message);
  process.exit(1);
});
