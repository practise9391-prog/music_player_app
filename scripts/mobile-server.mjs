import os from 'os';
import { spawn } from 'child_process';
import qrcode from 'qrcode-terminal';

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

console.log('\n==========================================================');
console.log('   🎵 NOVA MUSIC PLAYER — MOBILE STANDALONE INSTALLER');
console.log('==========================================================');
console.log('⏳ Fetching and preparing all application files...');

const localIp = getLocalIp();
const port = 5173;
const mobileUrl = `http://${localIp}:${port}`;

console.log('✨ Build ready! Generating QR Code for mobile installation...\n');

qrcode.generate(mobileUrl, { small: true }, (qr) => {
  console.log(qr);
  console.log('----------------------------------------------------------');
  console.log(`📱 MOBILE INSTALL LINK: ${mobileUrl}`);
  console.log('----------------------------------------------------------');
  console.log('📲 HOW TO INSTALL ON ANY PHONE:');
  console.log('  1. Open your camera or Expo Go and scan the QR code above.');
  console.log(`  2. Or open ${mobileUrl} in Chrome on Android.`);
  console.log('  3. Tap the "📲 Install" button on screen (or Chrome Menu -> "Install app").');
  console.log('  4. The standalone app installs onto your mobile home screen.');
  console.log('  5. Once installed, it runs 100% OFFLINE even if you close this server!');
  console.log('----------------------------------------------------------\n');
  console.log('🚀 Running server... (Press Ctrl+C to stop when done)\n');
});

// Launch Vite dev server on 0.0.0.0
const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(port)], {
  stdio: 'inherit'
});

vite.on('close', (code) => {
  process.exit(code || 0);
});
