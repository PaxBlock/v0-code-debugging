# Factory Contract Redeploy Guide - Remix (v2)

This guide helps you redeploy the UPDATED Factory and AcademicCertificate contracts on Sepolia Testnet.

## What Was Fixed?

**The Problem:** When setting a DIFFERENT wallet as institution admin, the Factory tried to grant roles AFTER deployment, but it didn't have permission to do so.

**The Fix:** The AcademicCertificate constructor now accepts BOTH addresses and grants `DEFAULT_ADMIN_ROLE` to both in the constructor itself - no post-deployment role granting needed.

**Updated behavior:**
- Pax owner deploys institution with ANY wallet as admin
- BOTH Pax owner AND institution admin get DEFAULT_ADMIN_ROLE
- No external role granting needed
- No permission errors

## Files Changed

You need to deploy BOTH updated contracts:
1. `contracts/AcademicCertificate.sol` - Updated constructor accepts paxOwner parameter
2. `contracts/Factory.sol` - Passes msg.sender as paxOwner to constructor

## Step-by-Step Redeploy Instructions

### 1. Open Remix IDE

1. Go to https://remix.ethereum.org/
2. Create a new workspace or use existing

### 2. Copy BOTH Contract Files

**File 1: AcademicCertificate.sol**
- Copy entire contents from `/vercel/share/v0-project/contracts/AcademicCertificate.sol`
- Create file in Remix: `AcademicCertificate.sol`
- Paste the code

**File 2: Factory.sol**
- Copy entire contents from `/vercel/share/v0-project/contracts/Factory.sol`
- Create file in Remix: `Factory.sol`
- Paste the code

### 3. Install OpenZeppelin Dependencies in Remix

In the Remix file explorer:
1. Right-click and create folder: `@openzeppelin`
2. Or use the Remix plugin to import OpenZeppelin contracts
3. Alternatively, change imports to use URLs:
   ```solidity
   import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC721/ERC721.sol";
   ```

### 4. Compile the Contracts

1. Click **Solidity Compiler** (checkmark icon)
2. Compiler version: `0.8.25` or compatible
3. First compile: `AcademicCertificate.sol`
4. Then compile: `Factory.sol`
5. Both should show green checkmarks

### 5. Deploy on Sepolia Testnet

**Prerequisites:**
- MetaMask connected to Sepolia Testnet
- Your Pax owner wallet connected
- Some SepoliaETH for gas

**Deploy the Factory:**
1. Click **Deploy & Run Transactions** (rocket icon)
2. Environment: **Injected Provider - MetaMask**
3. Contract dropdown: Select **Factory**
4. Click **Deploy**
5. Confirm in MetaMask
6. Wait for confirmation

### 6. Get Your New Factory Address

1. In **Deployed Contracts**, copy the new Factory address
2. Example: `0xABC123...`

### 7. Update Your Frontend

Edit `/vercel/share/v0-project/app/page.tsx`:

Find:
```typescript
const FACTORY_ADDRESS = '0xB0Ec1fF6C7850565595d69C07dE8cFBA15BF6361';
```

Replace with your new address:
```typescript
const FACTORY_ADDRESS = '0xYOUR_NEW_FACTORY_ADDRESS';
```

### 8. Test It!

1. Restart dev server
2. Go to Register Programme tab
3. Deploy institution with a DIFFERENT wallet as admin
4. It should now work!

## Role Structure After Fix

| Role | Pax Owner | Institution Admin |
|------|-----------|-------------------|
| DEFAULT_ADMIN_ROLE | Yes | Yes |
| Can configure signatories | Yes | Yes |
| Can issue certificates | Yes | Yes |
| Can manage issuers | Yes | Yes |

Both wallets have full admin capabilities. The Pax owner can configure signatories in Step 2, and the institution admin can issue certificates in the Issue tab.

## Troubleshooting

### Still getting permission error?
- Make sure you copied BOTH updated contract files
- Verify AcademicCertificate constructor has 5 parameters (including paxOwner)
- Check Factory is passing msg.sender as paxOwner

### Compilation errors?
- Ensure OpenZeppelin imports are resolved
- Use Remix's import resolver or URL imports

### Gas issues?
- Factory deployment costs more gas (deploys child contracts)
- Ensure you have 0.5+ SepoliaETH

---

**Summary of changes:**
- AcademicCertificate constructor: `(name, symbol, institutionAdmin, paxOwner, baseURI)`
- Factory passes `msg.sender` as paxOwner when deploying
- No more post-deployment role granting needed
