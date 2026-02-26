// Quick test script for Telegram notifications
const dotenv = require('dotenv');
dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

console.log('Testing Telegram Bot Configuration...\n');
console.log('Bot Token:', TOKEN ? `${TOKEN.substring(0, 15)}...` : '❌ MISSING');
console.log('Chat ID:', CHAT_ID || '❌ MISSING');

if (!TOKEN || !CHAT_ID) {
  console.error('\n❌ ERROR: Missing credentials in .env file');
  process.exit(1);
}

const testMessage = `🧪 <b>Test Notification</b>\n\nTelegram bot is working correctly!\nTimestamp: ${new Date().toLocaleString()}`;

console.log('\nSending test message...');

fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text: testMessage,
    parse_mode: 'HTML'
  })
})
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      console.log('✅ SUCCESS! Check your Telegram for the test message.');
    } else {
      console.error('❌ FAILED:', data);
    }
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
  });
