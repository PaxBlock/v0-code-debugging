# Pax Certificate Platform — Institution Administrator Guide

## What is Pax?

Pax is a blockchain-based academic credential platform. It lets you issue tamper-proof digital certificates to students that:
- Cannot be forged or modified
- Can be instantly verified by employers and other institutions
- Are stored forever on the blockchain (immutable)
- Include a QR code for easy sharing
- Are NFTs that students own in their digital wallets

## Getting Started (5 Minutes)

### Step 1: Access the Platform
1. Go to your Pax institution dashboard (URL will be provided by Pax)
2. Click "Connect Wallet" in the top right
3. Use MetaMask or your preferred Web3 wallet on **Sepolia Testnet** (or Base Mainnet for production)
4. Your wallet address will be shown with a role badge: "Admin" or "Issuer"

### Step 2: Register a Programme
**Only Admins can do this.** If you're an Issuer, skip to Step 3.

1. Click the **Register Programme** tab
2. **Step 1 — Deploy Programme:**
   - Enter programme name (e.g., "Bachelor of Physics 2024")
   - Enter symbol (e.g., "PHY24")
   - Your wallet will be auto-filled as admin
   - Click "Deploy Programme"
   - MetaMask will ask for confirmation — approve it
   - Wait 30 seconds for confirmation
   - A programme contract address will appear — save this

3. **Step 2 — Configure Institution:**
   - Paste the programme contract address from Step 1
   - Enter signatory names:
     - **Dean name** (e.g., "Prof. John Doe")
     - **Registrar name** (e.g., "Mrs. Jane Smith")
     - **Vice Chancellor name** (e.g., "Prof. Ahmed Hassan")
   - **Upload Institution Logo** (PNG, JPG, or SVG — max 2MB)
     - This logo will appear on every certificate
     - Keep it professional and clear
   - Click "Save Institution Config to Blockchain"
   - Approve in MetaMask
   - Your institution is now configured!

### Step 3: Issue Certificates to Students
**Both Admins and Issuers can do this.**

1. Click the **Issue Certificate** tab
2. **Step 1 — Issue a Certificate:**
   - **Select Programme:** Choose from your institution's programmes
   - **Student Wallet Address:** Paste the student's wallet address (e.g., 0x1234...)
   - **Student Full Name:** Enter exactly as it appears on their official record
   - **Course Name:** The course they took (e.g., "Electromagnetic Theory II")
   - **Grade:** Select from the dropdown (A+, A, B+, B, C+, C, D, F)
   - **PaxID:** Unique identifier — format: `PROGRAMME/YEAR/SERIAL`
     - Example: `PHY/2024/001`, `PHY/2024/002`, etc.
     - Keep the same programme code, increment the serial
   - **Student Email:** Their email address (optional)
     - If provided, they receive the certificate as a PDF attachment + email with QR code
   - Click "Issue Certificate"
   - Approve in MetaMask
   - The certificate is now on the blockchain forever!

3. **Step 2 — Register an Issuer (Admin only):**
   - If another staff member needs to issue certificates, enter their wallet address
   - Click "Grant Issuer Access"
   - They now have permission to issue on this programme

4. **Step 3 — Manage Certificates:**
   - **Revoke a certificate** if there was an error or fraudulent activity:
     - Enter student wallet or PaxID
     - Select a revocation reason
     - Optionally enter student email to notify them
     - Click "Revoke Certificate"
   - The certificate is marked as revoked on-chain but remains verifiable for audit purposes

---

## Verifying Certificates

**For anyone (employers, other institutions, students themselves):**

1. Click the **Verify Certificate** tab
2. Search by:
   - **PaxID:** Enter the certificate code (e.g., `PHY/2024/001`)
   - **Student Wallet:** Paste the student's wallet address
3. Click "Verify"
4. Results show:
   - Student name
   - Course and grade
   - Date issued
   - Issuing institution
   - Revocation status (if any)
5. Click "View Certificate" to see the full diploma image with all details
6. Scan the QR code with a phone — it auto-verifies and displays all information

---

## Student Experience

Students don't need to do anything after you issue a certificate. Here's what they get:

1. **Email with PDF:** They receive an email with a downloadable PDF of their certificate
2. **Wallet Auto-Display:** Their certificate appears in their Web3 wallet as an NFT (especially on Coinbase Wallet, Rainbow, Trust Wallet)
3. **QR Code Scanning:** They can share the certificate, employers scan the QR code, and it verifies instantly
4. **Permanence:** Once issued, the certificate exists on the blockchain forever — no risk of loss or server failure

---

## Key Features Explained

### What is a PaxID?
A unique identifier for each certificate. Format: `PROGRAMME/YEAR/SERIAL`
- `PROGRAMME`: Your programme code (e.g., PHY, ENG, MED)
- `YEAR`: Year of graduation (e.g., 2024)
- `SERIAL`: Sequential number (001, 002, 003...)

**Important:** PaxIDs are **case-insensitive** — `PHY/2024/001` and `phy/2024/001` are the same. Always use a consistent format.

### Wallet Address Format
Blockchain wallet addresses are 42 characters starting with "0x"
- Example: `0x1234567890abcdef1234567890abcdef12345678`
- Students must use the **same wallet address** when searching to verify their certificate

### Grades
Choose from standard grading scale:
- **A+, A:** Excellent
- **B+, B:** Good
- **C+, C:** Satisfactory
- **D:** Pass
- **F:** Fail

### Revocation
If you need to revoke a certificate:
- It remains on the blockchain but is marked as revoked
- The verification page shows "CERTIFICATE REVOKED" and the reason
- Use this only for genuine errors or fraud — it cannot be undone
- You can optionally notify the student via email

---

## Common Questions

**Q: Can a student lose or delete their certificate?**
No. Once issued on the blockchain, it is permanent and cannot be lost or deleted. Even if their wallet is compromised, the certificate record remains publicly verifiable.

**Q: How do employers verify a certificate?**
They go to the Pax platform, search by PaxID or student wallet, and see all details instantly. The blockchain guarantees authenticity.

**Q: Can certificates be forged?**
No. Only your institution's admin wallet can issue certificates. Forging would require controlling your private key, which only you have.

**Q: What if a student uses a different wallet?**
They must use the **exact same wallet address** that received the certificate. If they lose access to that wallet, they lose access to the NFT, but the certificate record remains verifiable on the blockchain by PaxID.

**Q: Is there a cost to issue certificates?**
On testnet: Free (for testing)
On mainnet: Small gas fee per certificate (typically $0.50-$2 depending on network conditions)

**Q: What if I make a typo when issuing a certificate?**
Revoke it (marks it as revoked on blockchain) and issue a new one with correct information. Both records remain on the blockchain for audit purposes.

---

## Support

For technical issues or questions:
- Contact: support@paxblockchain.com
- Documentation: https://docs.paxblockchain.com
- Smart contract is open-source and auditable on the blockchain

---

**Welcome to the future of academic credentials.**
