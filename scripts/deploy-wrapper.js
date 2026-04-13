#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[v0] Academic Certificate Smart Contract Deployment');
console.log('[v0] Target: Sepolia Testnet\n');

// Check environment variables
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL) {
  console.error('[v0] ERROR: SEPOLIA_RPC_URL not set');
  process.exit(1);
}

if (!PRIVATE_KEY) {
  console.error('[v0] ERROR: PRIVATE_KEY not set');
  process.exit(1);
}

console.log('[v0] ✓ Environment variables loaded');
console.log('[v0] RPC URL:', RPC_URL.substring(0, 50) + '...');
console.log('[v0] Private Key: ' + PRIVATE_KEY.substring(0, 10) + '....\n');

// Run hardhat deployment
console.log('[v0] Executing hardhat deployment...\n');

const deploy = spawn('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'sepolia'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SEPOLIA_RPC_URL: RPC_URL,
    PRIVATE_KEY: PRIVATE_KEY,
  },
});

deploy.on('close', (code) => {
  if (code === 0) {
    console.log('\n[v0] Deployment completed successfully!');
    
    // Check if deployment file was created
    if (fs.existsSync('./deployment-addresses.json')) {
      const addresses = JSON.parse(fs.readFileSync('./deployment-addresses.json', 'utf8'));
      console.log('[v0] Factory Address:', addresses.factory);
      console.log('[v0] Saved to: deployment-addresses.json');
    }
  } else {
    console.error('[v0] Deployment failed with code', code);
    process.exit(1);
  }
});
