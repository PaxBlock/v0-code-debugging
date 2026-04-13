DEPLOYMENT GUIDE: Deploy to Sepolia Testnet Using Remix IDE
===========================================================

This guide will walk you through deploying your smart contracts to Sepolia using Remix IDE (works on any browser, including Chromebook).

## Step 1: Prepare Your Contracts

You have two contracts:
1. **Factory.sol** (UniversityFactory) - Main entry point
2. **Main.sol** (AcademicCertificate) - Individual university contract

## Step 2: Go to Remix IDE

1. Open https://remix.ethereum.org in your browser
2. You should see the Remix interface with a file explorer on the left

## Step 3: Create Contract Files in Remix

### Option A: Copy-Paste Method
1. Click the "+" icon in the File Explorer to create a new file
2. Name it `UniversityFactory.sol`
3. Copy the entire content of Factory.sol and paste it into Remix
4. Click the "+" icon again and create `AcademicCertificate.sol`
5. Copy the entire content of Main.sol and paste it

### Option B: Upload Files
1. In File Explorer, right-click and select "Upload Files"
2. Select both Factory.sol and Main.sol from your computer

## Step 4: Compile the Contracts

1. Click the **Solidity Compiler** icon (looks like a play button) on the left sidebar
2. Select compiler version: **0.8.20** (same as your contracts)
3. Click **Compile UniversityFactory.sol**
4. Click **Compile AcademicCertificate.sol**
5. You should see green checkmarks - no errors!

## Step 5: Deploy to Sepolia

1. Click the **Deploy & Run Transactions** icon (looks like a network)
2. In the "ENVIRONMENT" dropdown, select: **Injected Provider - MetaMask**
3. MetaMask will pop up - connect your wallet that has Sepolia ETH
4. Make sure MetaMask shows "Sepolia Testnet" (top right)
5. In the "CONTRACT" dropdown, select: **UniversityFactory** (this deploys first)
6. Click **Deploy** (orange button)
7. MetaMask will ask you to confirm the transaction
8. Click **Confirm** in MetaMask
9. Wait for the transaction to complete (shows in Remix console at bottom)

## Step 6: SAVE YOUR FACTORY ADDRESS

After deployment, you should see something like:
```
UniversityFactory at 0x1234...5678 (your actual address)
```

**COPY AND SAVE THIS ADDRESS** - You'll need it for the UI!

## Step 7: Verify on Sepolia Testnet

1. Go to https://sepolia.etherscan.io/
2. Paste your Factory contract address in the search box
3. You should see your contract with all the details

## Common Issues & Fixes

**Issue: "MetaMask not found"**
- Install MetaMask extension for Chrome/Brave
- Or use other wallets like WalletConnect

**Issue: "Compiler version mismatch"**
- Make sure you select 0.8.20 in the compiler settings
- If not available, click "Compile & Run" to use the latest

**Issue: "Contract creation failed"**
- You need at least 0.01 Sepolia ETH
- Get more from: https://www.sepoliafaucet.com/

**Issue: "Not enough gas"**
- Increase gas limit in MetaMask before confirming

## Next Steps

Once you have your Factory address:
1. Come back to this project
2. I'll build the UI that connects to your deployed contract
3. You'll be able to deploy universities and issue certificates through the web interface!

=== END OF GUIDE ===
