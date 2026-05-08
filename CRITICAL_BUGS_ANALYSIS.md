# Critical Bugs Analysis & Fixes for Pilot

## Bug #1: Step 2 Signatory Config Access Control ✅ PARTIALLY FIXED

**Status:** UI-level fix applied. Smart contract redeploy may be needed.

**What was wrong:**
- When Pax owner wallet was also set as programme admin, they got "access denied" error trying to configure signatories
- UI didn't validate that only Pax owner could access Step 2

**Fix Applied:**
- Added `walletRole !== 'owner'` check in `saveInstitutionConfig()` 
- Added red warning banner for non-owners in Step 2 UI
- Labeled Step 2 as "Pax owner only"

**Permanent Fix Needed:**
- Update `AcademicCertificate.sol` line 72: `setInstitutionConfig()` currently requires `DEFAULT_ADMIN_ROLE`
- Change to: Only allow Factory owner (Pax owner) to call this function
- This requires a new smart contract deployment

---

## Bug #2: Admin Can't Create Issuers ⚠️ INVESTIGATING

**Status:** Smart contract logic appears correct, need to identify actual error

**What happens:**
- Admin tries to grant ISSUER_ROLE to a staff member
- Calls `university.grantRole()` ✅ (should work)
- Then calls `factory.registerIssuer()` ✅ (contract allows admin to call this)
- Something is failing

**Possible causes:**
1. University contract doesn't have the ISSUER_ROLE defined? (Check AcademicCertificate.sol)
2. Admin doesn't have ROLE_ADMIN permission to grant roles? (AccessControl requirement)
3. The registerIssuer call is being made with wrong parameters?

**Next step:** Need actual error message from your test to diagnose

---

## Bug #3: Admin Must Self-Issuer to Issue Certificates ⚠️ LIKELY ROOT CAUSE

**Status:** Design issue - not a bug, just unclear flow

**What happens:**
- Admin sets themselves as an issuer to be able to issue certificates
- This seems wrong from a UX perspective

**Why it happens:**
- `issueCertificate()` requires `ISSUER_ROLE` in the university contract
- Admin has `DEFAULT_ADMIN_ROLE` which doesn't automatically grant `ISSUER_ROLE`
- So admins must explicitly grant themselves the issuer role

**Fix:**
- Make `issueCertificate()` allow BOTH `ISSUER_ROLE` OR `DEFAULT_ADMIN_ROLE`
- Requires smart contract change in `AcademicCertificate.sol` line 88

---

## Enhancement: Signature Drawing Pad

**Status:** Not yet implemented

**What we need:**
- Replace signature image upload with a drawing canvas
- Pax owner draws signature in Step 2
- Signature stored as SVG or canvas data URL
- Displayed on certificates instead of text names

**Libraries needed:**
- `react-signature-canvas` for drawing pad
- Store as image (PNG) or SVG path string

---

## Enhancement: Dynamic Institutional Seal

**Status:** Not yet implemented

**What we need:**
- Generate circular seal with spiky edge (like OAU example)
- Institution name around the perimeter
- Icon/emblem in the center
- Should be circular and positioned to not block QR code

**Can use:**
- SVG generation or `canvas-based` approach
- Should automatically generate from institution name + logo

---

## QR Code Domain Fix

**Status:** Partially implemented - need to finish

**What needs to do:**
- Make certificate image API detect request domain
- Use actual domain instead of hardcoded `v0-paxadmin.vercel.app`
- QR code should point to `test.paxblockchain.com` (or whatever domain is used)

**Code location:**
- `/app/api/certificate/image/route.tsx` - needs to detect `request.url` domain

