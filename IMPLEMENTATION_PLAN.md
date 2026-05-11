# Implementation Plan: Bug Fixes & Enhancements

## CRITICAL BUGS (Must Fix Before Pilot)

### 1. Register Programme Tab Access Control
**Status:** BUG - Step 2 is accessible to admins and shows "Access denied" error
**Root Cause:** Step 2 (Configure Institution Signatories) has NO role check. Anyone with wallet access to the deploy tab can see it.
**Fix Required:**
- Add conditional: Step 2 should ONLY render if `walletRole === 'owner'`
- All three steps (Deploy, Signatories, Manage) must be Pax owner only
- If non-owner somehow navigates to deploy tab, they see "Access Restricted" overlay for ALL steps

### 2. Admin Cannot Create Other Issuers
**Status:** BUG - When an admin registers another user as issuer via `registerIssuer()`, the call fails
**Root Cause:** `registerIssuer()` in smart contract likely checks `onlyAdmin()` but the caller (admin) isn't granted ISSUER_ROLE properly
**Investigation Needed:** Check if the admin calling registerIssuer has proper role delegation. May need to adjust smart contract or add issuer management UI to Issue tab for admins.
**Temporary Workaround:** Only Pax owner can register issuers (via Remix) until this is fixed.

### 3. Admin Auto-Issue Certificates
**Status:** CLARIFICATION NEEDED
**Current Behavior:** Admins must select their own wallet + grant themselves issuer role before issuing
**Desired:** Admins should auto-issue without explicit issuer role grant
**Fix:** Modify Issue tab logic - if wallet is admin, skip the issuer check and allow issuance directly

---

## ENHANCEMENTS (Nice-to-Have, Post-Pilot)

### 4. QR Code Domain Detection
**Status:** TODO - QR code hardcoded to v0-paxadmin.vercel.app
**Solution:** Update `/api/certificate/image` to detect request domain from headers and use it in QR code URL
**Priority:** HIGH - Users expect custom domain

### 5. University Name Cleanup
**Status:** TODO - Currently stored as "University-BSc"
**Desired:** Store only "University" name. Degree is tracked separately in programme/course fields
**Changes:**
- Step 1: Keep the degree dropdown (BSc, PhD, etc) as a separate field
- In contract: Don't append degree to university name
- On certificate: Only show university name, not degree

### 6. Institutional Seal/Badge
**Status:** DESIGN PHASE
**Concept:** Circular seal with institution name around the edge + logo in center (like real certificates)
**Positioning:** Bottom right of certificate, NOT blocking QR code
**Generation Options:**
- A) Dynamic SVG generation with institution name + logo
- B) Custom upload per institution
- Recommendation: A + fallback to B

### 7. Signature Images
**Status:** DESIGN PHASE
**Current:** Just names printed (Dean, Registrar, VC)
**Desired:** Actual signature images
**Implementation Options:**
- A) Admins upload signature image once per role, stored in Blob
- B) Signature uploaded per certificate issuance
- C) Signature field in institution config
- Recommendation: C - Store once in institution config, display on all certificates

### 8. Copy Button for Wallet Address
**Status:** TODO - Simple UX improvement
**Where:** Header wallet address display
**Implementation:** Add copy icon next to address, copy to clipboard on click

### 9. Verification Domain Field
**Status:** EXISTS but unclear
**Current:** Optional field in Step 2: "Verification Domain (optional)"
**Purpose:** If filled, this domain is printed on QR code instead of default platform URL
**Example:** Institution fills "verify.oauife.edu.ng" → QR code points to verify.oauife.edu.ng/?tab=verify...
**Enhancement:** Make this clearer in UI that it overrides the default domain

---

## RECOMMENDED FIX ORDER

1. **Fix Step 2 Access Control** (1 hour) - Prevents admin errors
2. **Fix Admin Issues** (2 hours) - Unblock admin workflows
3. **QR Code Domain** (30 mins) - Quick win for custom domains
4. **Copy Button** (15 mins) - Easy UX improvement
5. **University Name Cleanup** (1 hour) - Clean up data model
6. **Institutional Seal Design** (3 hours) - Visual enhancement
7. **Signature Images** (2 hours) - Authenticity improvement

---

## POST-PILOT FEATURES
- Custom seal uploads per institution
- Signature pad (draw signature in UI)
- Certificate versioning/updates
- Batch certificate issuance
