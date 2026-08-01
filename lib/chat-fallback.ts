// Fallback knowledge base for the PAX Assistant.
// Used when the AI Gateway is unavailable (e.g. billing verification pending),
// so admins still get accurate answers to common platform questions.

export interface KnowledgeTopic {
  id: string;
  keywords: string[];
  answer: string;
}

export const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  {
    id: 'issue-single',
    keywords: ['issue', 'single', 'certificate', 'credential', 'mint', 'create', 'one', 'how do i issue', 'how can i issue', 'issue academic'],
    answer: `To issue a single academic credential as an institution:

1. Connect your wallet (top right). You must be an authorised issuer or programme admin.
2. Go to the "Issue Certificate" tab.
3. Select your programme from the dropdown.
4. Fill in the student's details: wallet address, full name, course/degree, grade, and PaxID (e.g. PHY/2022/054).
5. Select the faculty so the correct dean's name and signature appear.
6. Click "Issue Certificate" and confirm the transaction in MetaMask.
7. If you entered the student's email, the certificate is emailed to them automatically after the transaction confirms.

The credential is minted as an NFT on the blockchain and the student's name, course, and grade are stored encrypted — only the student and authorised parties can decrypt them.`,
  },
  {
    id: 'issue-bulk',
    keywords: ['bulk', 'csv', 'batch', 'multiple', 'many', 'upload', 'spreadsheet', '100', 'mass'],
    answer: `To issue certificates in bulk using a CSV file:

1. Go to the "Issue Certificate" tab and select your programme.
2. Download the CSV template to see the required columns: StudentName, StudentWallet, StudentEmail, CourseName, Grade, PaxID, FacultyName.
3. Fill in one row per student. The FacultyName must exactly match a faculty you registered in Step 2 (e.g. "Faculty of Science") — the dean's signature is pulled from it.
4. Upload the CSV. The system validates every row and flags errors before you spend any gas.
5. Click "Issue All". Certificates are issued in batches of 15 per transaction to stay within gas limits, so 100 certificates = 7 MetaMask confirmations.
6. After all batches confirm, certificates are emailed to every student with an email address.

Tip: watch the validation preview — any row with a problem is marked invalid with the reason, so you can fix the CSV and re-upload before issuing.`,
  },
  {
    id: 'csv-format',
    keywords: ['csv format', 'columns', 'template', 'headers', 'what columns', 'csv file', 'format'],
    answer: `The bulk CSV must have these columns in the header row:

StudentName, StudentWallet, StudentEmail, CourseName, Grade, PaxID, FacultyName

- StudentName: full name of the graduate
- StudentWallet: their Ethereum wallet address (0x...)
- StudentEmail: where the certificate is emailed (optional but recommended)
- CourseName: the degree or course (e.g. B.Sc. Physics)
- Grade: the classification (e.g. First Class)
- PaxID: the unique credential ID (e.g. PHY/2022/054)
- FacultyName: must exactly match a registered faculty on the programme (e.g. Faculty of Science)

Download the template from the bulk issuance section to get a ready-made example.`,
  },
  {
    id: 'register-programme',
    keywords: ['register', 'programme', 'program', 'university', 'institution', 'create programme', 'new programme', 'deploy'],
    answer: `To register a new programme:

1. Connect the wallet that will administer the programme.
2. Go to the "Register Programme" tab (visible to programme admins).
3. Enter the institution name and programme name.
4. Confirm the transaction in MetaMask — this deploys a dedicated smart contract for your programme.
5. Once confirmed, go to "Issue Certificate" → Step 2 to configure your institution: upload your logo, add registrar and vice-chancellor names and signatures, and register faculties with their deans.

Each programme gets its own contract, so your credentials are fully isolated from other institutions.`,
  },
  {
    id: 'configure-institution',
    keywords: ['configure', 'setup', 'set up', 'logo', 'signature', 'registrar', 'vice chancellor', 'vc', 'institution config', 'step 2'],
    answer: `To configure your institution (Step 2 on the Issue Certificate tab):

1. Select your programme.
2. Upload your institution logo (PNG or JPG, max 2MB) — it appears on every issued certificate.
3. Enter the Registrar's name and draw or upload their signature.
4. Enter the Vice-Chancellor's name and signature.
5. Register each faculty with its dean's name and signature (e.g. "Faculty of Law" with the dean's details).
6. Save the configuration — this is stored on-chain and used to render certificates.

Important: use PNG or JPG for the logo. SVG and WebP are not supported by the certificate renderer.`,
  },
  {
    id: 'faculty-dean',
    keywords: ['faculty', 'dean', 'dean signature', 'faculties', 'add faculty', 'register faculty'],
    answer: `Faculties and deans are registered in Step 2 (Configure Institution):

1. Select your programme on the Issue Certificate tab.
2. In the faculties section, add each faculty name (e.g. "Faculty of Science") along with the dean's name and signature.
3. Save the configuration.

When issuing certificates, the faculty you select (or the FacultyName column in a bulk CSV) determines which dean's name and signature appear on the certificate. The names must match — the system normalises spacing and case, so "faculty of science" still matches "Faculty of Science".`,
  },
  {
    id: 'authorize-issuer',
    keywords: ['issuer', 'authorise', 'authorize', 'staff', 'grant', 'role', 'add issuer', 'permission'],
    answer: `To authorise a staff member to issue certificates:

1. Connect with the programme admin wallet.
2. Go to the Issue Certificate tab → Step 1 "Authorise a Certificate Issuer".
3. Select the programme.
4. Enter the staff member's wallet address.
5. Click "Authorise Issuer" and confirm in MetaMask.

This is a one-time setup per issuer per programme. Once authorised, the staff member can connect their own wallet and will see the programme in their dropdown — they can then issue certificates but cannot manage the programme configuration.`,
  },
  {
    id: 'verify',
    keywords: ['verify', 'verification', 'check', 'authentic', 'validate', 'confirm', 'employer'],
    answer: `To verify a certificate:

1. Go to the "Verify Certificate" tab — no wallet connection needed, it's open to the public.
2. Select the institution and programme.
3. Search by PaxID (e.g. PHY/2022/054) or by the graduate's wallet address.
4. The system shows the certificate's status: valid or revoked, along with the issue date and transaction hash.

Verification works for ALL institutions, including deactivated ones — a credential remains verifiable even if the institution is no longer active. Employers can independently confirm authenticity directly against the blockchain.`,
  },
  {
    id: 'revoke',
    keywords: ['revoke', 'revocation', 'cancel', 'invalidate', 'withdraw', 'deactivate certificate'],
    answer: `To revoke a certificate:

1. Connect with an authorised wallet (programme admin or issuer).
2. Go to the revocation section and select the programme.
3. Enter the student's PaxID (e.g. PHY/2022/054) — the system looks up the certificate automatically.
4. Choose a revocation reason (or enter a custom one).
5. Optionally enter the student's email to send them a revocation notification.
6. Confirm the transaction in MetaMask.

The revocation and its reason are recorded permanently on the blockchain. Anyone verifying that PaxID afterwards will see the certificate marked as revoked.`,
  },
  {
    id: 'paxid',
    keywords: ['paxid', 'pax id', 'matric', 'id format', 'credential id', 'phy/2022'],
    answer: `A PaxID is the unique identifier for each credential, in the format: DEPARTMENT/YEAR/NUMBER

Example: PHY/2022/054 — a Physics graduate from 2022, credential number 054.

The PaxID is set at issuance and is the easiest way to look up a certificate for verification or revocation. Each PaxID maps to exactly one certificate on a programme, and the smart contract resolves it to the graduate's wallet address on-chain.`,
  },
  {
    id: 'gas-batching',
    keywords: ['gas', 'limit', 'out of gas', 'batch', '15', 'cost', 'expensive', 'fee', 'transaction failed'],
    answer: `About gas and batching:

Each certificate costs roughly 300k–500k gas (NFT mint + encrypted data storage). To stay safely under the block gas limit, bulk issuance is split into batches of 15 certificates per transaction — so 100 certificates require 7 MetaMask confirmations.

On Sepolia testnet, gas is free (test ETH from a faucet). On Base mainnet, the same 100-certificate issuance would cost roughly $0.50–$3.00 total, because Base is a Layer 2 network with much lower fees than Ethereum mainnet.

If a transaction fails with "out of gas", it means the batch was too large — the current batching logic already prevents this.`,
  },
  {
    id: 'networks',
    keywords: ['sepolia', 'base', 'network', 'mainnet', 'testnet', 'layer 2', 'l2', 'deploy', 'chain'],
    answer: `The platform currently runs on Sepolia (Ethereum's testnet) for development and testing — gas is free with test ETH.

The production target is Base, an Ethereum Layer 2 network. Base offers:
- 10–100x lower transaction costs than Ethereum mainnet
- Fast confirmations
- Full Ethereum security (it settles to Ethereum L1)

Before going live on Base mainnet, you can test on Base Sepolia (Base's own testnet) at near-zero cost. The migration only requires updating the network configuration (chain ID, RPC URL, and contract addresses) — the smart contracts and app code stay the same.`,
  },
  {
    id: 'troubleshoot-dean',
    keywords: ['dean not showing', 'no dean', 'missing dean', 'dean signature missing', 'signature not showing', 'blank dean'],
    answer: `If the dean's signature is missing from an issued certificate:

The cause is almost always a faculty name mismatch. The FacultyName in your CSV (or the selected faculty) must match a faculty registered in Step 2. The system now normalises spacing and case automatically, and validates faculty names when you upload a CSV — invalid rows are flagged before issuance.

To fix already-issued certificates: re-send the certificate email after confirming the faculty is registered correctly. The blockchain record is fine; only the rendered image was missing the dean.`,
  },
  {
    id: 'troubleshoot-logo',
    keywords: ['logo not showing', 'no logo', 'missing logo', 'logo blank', 'image not showing'],
    answer: `If your institution logo doesn't appear on certificates:

1. Make sure the logo is a PNG or JPG — SVG and WebP are not supported by the certificate renderer.
2. Re-upload the logo in Step 2 (Configure Institution) and save the configuration.
3. New certificates will include the logo. For already-issued certificates, re-send the email — the image is rendered fresh each time.

The certificate renderer now detects the true image format automatically, so logos uploaded before the fix also work.`,
  },
  {
    id: 'troubleshoot-wallet',
    keywords: ['wallet', 'metamask', 'connect', 'connection', 'not connecting', 'unlock'],
    answer: `If your wallet won't connect:

1. Make sure the MetaMask extension is installed and unlocked.
2. Refresh the page — MetaMask sometimes needs a clean state.
3. Click "Connect Wallet" again — the app retries the connection automatically up to 3 times.
4. Check that MetaMask is set to the Sepolia network.
5. If you rejected the connection prompt, just try again and approve it.

If it still fails, open the browser console (F12) and look for [v0] log messages — they show exactly what step failed.`,
  },
  {
    id: 'troubleshoot-issuer-programmes',
    keywords: ['no programmes', 'programme not showing', 'issuer dropdown', 'empty dropdown', 'assigned'],
    answer: `If an authorised issuer sees "No programmes are currently assigned to your wallet":

This was a known bug that is now fixed — the programme dropdown scans for both admin-owned programmes AND programmes where your wallet holds the issuer role. Just click "Refresh" or reconnect your wallet and the programme will appear.

If it still doesn't show, confirm with the programme admin that your wallet address was authorised on the correct programme (Step 1).`,
  },
  {
    id: 'about',
    keywords: ['what is', 'about', 'pax', 'platform', 'how does it work', 'explain', 'overview'],
    answer: `PAX is a blockchain-verified academic credential system. Institutions issue certificates as NFTs on Ethereum, making them tamper-proof and independently verifiable by anyone — employers, other institutions, or the public.

Key features:
- Single and bulk (CSV) certificate issuance
- Encrypted student data on-chain (only authorised parties can decrypt)
- Digital signatures from deans, registrars, and vice-chancellors rendered on each certificate
- Public verification by PaxID or wallet address — no account needed
- On-chain revocation with permanently recorded reasons
- Automatic email delivery of certificates to graduates

The platform runs on Sepolia testnet, with production deployment planned for Base (Ethereum Layer 2) for dramatically lower costs.`,
  },
  {
    id: 'roles',
    keywords: ['role', 'admin', 'owner', 'permissions', 'who can', 'access', 'super admin'],
    answer: `The platform has three role levels:

1. Super Admin (contract owner): manages the institution registry, can activate/deactivate institutions, and oversees all programmes.
2. Programme Admin: the wallet that registered a programme. Can configure the institution (logo, signatures, faculties), authorise issuers, issue certificates, and revoke them.
3. Issuer: a staff member authorised by the programme admin. Can issue and revoke certificates on that programme, but cannot change the configuration.

Verification is public — anyone can verify a certificate without any role or wallet.`,
  },
  {
    id: 'email',
    keywords: ['email', 'send', 'notification', 'student email', 'resend', 'not received'],
    answer: `Certificate emails are sent automatically after issuance when a student email is provided:

- Single issuance: enter the student's email in the form.
- Bulk issuance: fill the StudentEmail column in the CSV.

The email contains the rendered certificate image (with logo and all signatures) and a verification link. If a certificate is revoked and an email is provided, a revocation notification is also sent.

If a student didn't receive the email, check spam/junk folders first. The certificate itself lives on the blockchain regardless — the email is just a convenient copy.`,
  },
  {
    id: 'security',
    keywords: ['security', 'encrypt', 'encryption', 'privacy', 'data', 'gdpr', 'safe', 'secure'],
    answer: `How PAX protects credential data:

- Student names, courses, and grades are encrypted before being stored on-chain. Only the student's wallet and authorised institutional wallets can decrypt them.
- The PaxID and certificate status (valid/revoked) are public — that's what makes verification possible without exposing personal data.
- All blockchain interactions require explicit wallet signatures (MetaMask confirmations) — no action happens without the authorised wallet approving it.
- Role-based access control is enforced by the smart contract itself, not just the app.

This design keeps the system GDPR-conscious: personal data is encrypted, while verifiability remains public.`,
  },
];

// Normalise text for matching: lowercase, strip punctuation, collapse spaces.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score a question against a topic by counting keyword hits.
// Longer (more specific) keywords count double.
function scoreTopic(question: string, topic: KnowledgeTopic): number {
  let score = 0;
  for (const keyword of topic.keywords) {
    const k = normalize(keyword);
    if (k && question.includes(k)) {
      score += k.includes(' ') ? 3 : 1; // multi-word keywords are stronger signals
    }
  }
  return score;
}

/**
 * Find the best matching answer for a user question.
 * Returns null if no topic scores high enough.
 */
export function findFallbackAnswer(rawQuestion: string): string | null {
  const question = normalize(rawQuestion);
  if (!question) return null;

  let best: KnowledgeTopic | null = null;
  let bestScore = 0;

  for (const topic of KNOWLEDGE_BASE) {
    const score = scoreTopic(question, topic);
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  // Require a minimum confidence: at least 2 points (e.g. two keyword hits or one strong phrase).
  if (!best || bestScore < 2) return null;
  return best.answer;
}

export const FALLBACK_GREETING =
  "I'm currently running in offline mode because the AI service isn't activated on this Vercel account yet (a card needs to be added to the team's AI Gateway billing). I can still answer common questions about the platform — try asking about issuing certificates, bulk CSV uploads, verification, revocation, faculties, or troubleshooting.";
