#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  try {
    console.log('========================================');
    console.log('Academic Certificate Deployment Script');
    console.log('Target: Sepolia Testnet');
    console.log('========================================\n');

    // Check env vars
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;

    if (!RPC_URL) {
      throw new Error('SEPOLIA_RPC_URL environment variable not set');
    }
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }

    console.log('[1/3] Verifying environment variables...');
    console.log('✓ RPC URL configured');
    console.log('✓ Private Key configured\n');

    // Step 1: Compile contracts
    console.log('[2/3] Compiling Solidity contracts...');
    try {
      execSync('npx hardhat compile', { stdio: 'inherit' });
      console.log('✓ Contracts compiled successfully\n');
    } catch (e) {
      console.error('✗ Compilation failed');
      throw new Error('Failed to compile contracts');
    }

    // Step 2: Deploy using hardhat
    console.log('[3/3] Deploying to Sepolia...');
    try {
      execSync('npx hardhat run scripts/deploy.js --network sepolia', {
        stdio: 'inherit',
        env: {
          ...process.env,
          SEPOLIA_RPC_URL: RPC_URL,
          PRIVATE_KEY: PRIVATE_KEY,
        },
      });
      console.log('\n✓ Deployment completed!\n');
    } catch (e) {
      console.error('✗ Deployment failed');
      throw new Error('Failed to deploy contracts');
    }

    // Read and display deployment addresses
    if (fs.existsSync('./deployment-addresses.json')) {
      const addresses = JSON.parse(fs.readFileSync('./deployment-addresses.json', 'utf8'));
      console.log('========================================');
      console.log('DEPLOYMENT SUCCESSFUL');
      console.log('========================================');
      console.log('Factory Address: ' + addresses.factory);
      console.log('Network: ' + addresses.network);
      console.log('========================================');
      console.log('\nSave the Factory Address for your UI!');
    }

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    process.exit(1);
  }
}

main();
