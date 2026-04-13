#!/usr/bin/env node
const { ethers } = require('ethers');
const fs = require('fs');

async function deploy() {
  try {
    console.log('[v0] Starting deployment...\n');

    // Get environment variables
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;

    if (!RPC_URL || !PRIVATE_KEY) {
      throw new Error('Missing SEPOLIA_RPC_URL or PRIVATE_KEY environment variables');
    }

    // Create provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('[v0] Deploying from account:', signer.address);

    // Check balance
    const balance = await provider.getBalance(signer.address);
    console.log('[v0] Account balance:', ethers.formatEther(balance), 'ETH\n');

    if (balance === 0n) {
      throw new Error('Insufficient balance. Please get Sepolia ETH from a faucet.');
    }

    // Read contract ABIs and bytecode from artifacts
    const factoryArtifact = JSON.parse(
      fs.readFileSync('./artifacts/contracts/Factory.sol/UniversityFactory.json', 'utf8')
    );

    const factoryFactory = new ethers.ContractFactory(
      factoryArtifact.abi,
      factoryArtifact.bytecode,
      signer
    );

    console.log('[v0] Deploying UniversityFactory...');
    const factory = await factoryFactory.deploy();
    const deployTx = factory.deploymentTransaction();

    console.log('[v0] Deployment tx hash:', deployTx.hash);
    console.log('[v0] Waiting for confirmation...');

    const receipt = await factory.deploymentTransaction().wait();
    const factoryAddress = await factory.getAddress();

    console.log('[v0] ✓ UniversityFactory deployed successfully!');
    console.log('\n=== DEPLOYMENT COMPLETE ===');
    console.log('Factory Address:', factoryAddress);
    console.log('Network: Sepolia');
    console.log('Tx Hash:', receipt.hash);
    console.log('===========================\n');

    // Save addresses
    const deploymentData = {
      factory: factoryAddress,
      network: 'sepolia',
      chainId: 11155111,
      deploymentDate: new Date().toISOString(),
      transactionHash: receipt.hash,
    };

    fs.writeFileSync(
      './deployment-addresses.json',
      JSON.stringify(deploymentData, null, 2)
    );

    console.log('[v0] Addresses saved to deployment-addresses.json');
    process.exit(0);

  } catch (error) {
    console.error('[v0] Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy();
