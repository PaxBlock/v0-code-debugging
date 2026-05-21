# Factory Contract Redeploy Guide - Remix

This guide will help you redeploy the updated Factory contract on Sepolia Testnet using Remix.

## Why Redeploy?

Your current Factory contract on Sepolia has restrictions that only allow your wallet to be set as the institution admin. The updated version removes ALL restrictions and allows ANY EVM-compatible wallet address to be an institution admin.

**Updated behavior:**
- ✅ ANY wallet address can be set as institution admin
- ✅ No whitelist or restrictions
- ✅ Supports multi-sig wallets, different addresses, any EVM account
- ✅ Better validation and clearer documentation

## Step-by-Step Redeploy Instructions

### 1. Prepare Your Updated Factory Contract

The updated `Factory.sol` is available in your project at:
```
/vercel/share/v0-project/contracts/Factory.sol
```

This version includes:
- Input validation (non-zero address, non-empty strings)
- NO restrictions on admin address
- Clear documentation stating ANY EVM address can be admin

### 2. Open Remix IDE

1. Go to https://remix.ethereum.org/
2. Create a new file: Click the "+" icon in the left sidebar
3. Name it: `Factory.sol`

### 3. Copy the Updated Contract Code

1. Copy the entire `Factory.sol` from your project
2. Paste it into Remix
3. Also ensure you have `AcademicCertificate.sol` available in Remix (it's imported)

### 4. Compile the Contract

1. In the left sidebar, click **Solidity Compiler** (looks like a checkmark icon)
2. Compiler version should be: `0.8.25` or compatible
3. Click **Compile Factory.sol**
4. You should see a green checkmark - no errors

### 5. Deploy on Sepolia Testnet

**Prerequisites:**
- MetaMask installed and connected to Sepolia Testnet
- Your Pax owner wallet connected (the one that created the original Factory)
- Some SepoliaETH for gas fees

**Deployment steps:**

1. In the left sidebar, click **Deploy & Run Transactions** (rocket icon)
2. Environment dropdown: Select **Injected Provider - MetaMask**
3. MetaMask should show Sepolia Testnet is connected
4. Contract dropdown: Make sure **Factory** is selected (not AcademicCertificate)
5. Click **Deploy**
6. MetaMask will pop up - confirm the transaction
7. Wait for confirmation (~30 seconds)

### 6. Get Your New Factory Address

After deployment completes:
1. In the **Deployed Contracts** section, you'll see the new Factory address
2. Copy this address (starts with 0x)
3. Example: `0x1234...5678`

### 7. Update Your Frontend

1. Open your v0 project
2. Find: `/vercel/share/v0-project/app/page.tsx`
3. Locate the line:
   ```typescript
   const FACTORY_ADDRESS = '0x85ed98B33160679BFcF12d82F219Ee5cBB8B68a1';
   ```
4. Replace with your new Factory address:
   ```typescript
   const FACTORY_ADDRESS = '0xYOUR_NEW_ADDRESS_HERE';
   ```
5. Save the file

### 8. Update Your ABI (if needed)

The ABI should remain the same since we didn't change the function signatures, only added validation and documentation. But if you need to update it:

1. In Remix, with Factory.sol selected
2. Click the **ABI copy button** 
3. Update your FACTORY_ABI in your codebase if it differs

### 9. Test the New Deployment

1. Restart your dev server: `npm run dev`
2. Go to the Register Programme tab (Deploy)
3. Try deploying a new institution with:
   - Institution Name: "Test Institution"
   - Symbol: "TEST"
   - **Admin Wallet: Use a DIFFERENT wallet address** (not your Pax owner wallet)
4. It should now work without errors!

## Verification on Etherscan

1. Go to https://sepolia.etherscan.io/
2. Search for your new Factory address
3. Click **Contract** tab
4. You should see the source code with the updated validation and documentation

## Troubleshooting

### "execution reverted" error
- Make sure you're using the NEW Factory address in your frontend
- Verify the address was updated in `app/page.tsx`

### Gas estimation issues
- You have enough SepoliaETH (~0.1-0.5 should be plenty)
- Try adjusting gas limit manually in MetaMask if needed

### Contract not showing after deploy
- Refresh Remix page
- Make sure you're still connected to the same wallet
- Check MetaMask is showing Sepolia Testnet

### Can't deploy - "FACTORY_ADMIN_ROLE not found"
- Make sure `AcademicCertificate.sol` is in your Remix workspace
- The Factory imports it, so Remix needs both files

## After Successful Redeploy

Once the new Factory is deployed and working:

1. Your institutions will now be created with the new Factory
2. Old institutions remain on the blockchain and are still verifiable
3. Issuers can now use ANY wallet address as the institution admin
4. You can migrate institutions by redeploying with different admins if needed

---

**Need help?** Check that:
- ✅ You're connected to Sepolia Testnet
- ✅ You have enough SepoliaETH for gas
- ✅ The new Factory address is updated in your frontend
- ✅ You're using the correct wallet (Pax owner) to deploy
