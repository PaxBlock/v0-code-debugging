// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import SignatureCanvas from 'react-signature-canvas';
import { logGDPRCompliant } from '@/lib/dataMasking';

// Factory contract - PaxID, grade, signatory config, logo URL, deactivation support
const FACTORY_ADDRESS = '0xA66f40f188dBC8718207210b76EB39F72b85CE05';
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX = '0xaa36a7';
const BASE_METADATA_URI = 'https://ipfs.io/ipfs/'; // Base URI for certificate metadata storage

const FACTORY_ABI = [
  'function deployUniversity(string memory universityName, string memory symbol, address universityAdmin, string memory baseMetadataURI) external returns (address)',
  'function getUniversityCount() external view returns (uint256)',
  'function deployedUniversities(uint256 index) external view returns (address)',
  'function getActiveUniversities() external view returns (address[])',
  'function getAllUniversities() external view returns (address[])',
  'function getWalletUniversities(address wallet) external view returns (address[])',
  'function registerIssuer(address universityContract, address wallet) external',
  'function isUniversityContract(address) external view returns (bool)',
  'function isDeactivated(address) external view returns (bool)',
  'function deactivationReason(address) external view returns (string)',
  'function deactivationDate(address) external view returns (uint256)',
  'function deactivateUniversity(address universityContract, string memory reason) external',
  'function reactivateUniversity(address universityContract) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
  'function FACTORY_ADMIN_ROLE() external view returns (bytes32)',
];

const UNIVERSITY_ABI = [
  'function name() external view returns (string)',
  'function issueCertificate(address student, string memory _candidateName, string memory _courseName, string memory _grade, string memory _paxId) external returns (uint256)',
  'function hasCertificate(address student) external view returns (bool)',
  'function certificates(uint256 tokenId) external view returns (string candidateName, string courseName, string grade, string paxId, uint256 issuanceDate, address issuer)',
  'function studentToTokenId(address student) external view returns (uint256)',
  'function grantRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ISSUER_ROLE() external view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
  'function revokeCertificate(address student, string memory reason) external',
  'function isRevoked(address student) external view returns (bool)',
  'function revocationReason(address student) external view returns (string)',
  'function revocationDate(address student) external view returns (uint256)',
  'function resolvePaxId(string memory paxId) external view returns (address)',
  'function setInstitutionConfig(string memory registrarName, string memory registrarSignatureURL, string memory viceChancellorName, string memory viceChancellorSignatureURL, string memory deanName, string memory deanSignatureURL, string memory verificationDomain, string memory logoURL) external',
  'function setFacultySignatory(string memory facultyName, string memory deanName, string memory deanSignatureURL) external',
  'function getFacultySignatories() external view returns (tuple(string facultyName, string deanName, string deanSignatureURL)[])',
  'function getFacultyCount() external view returns (uint256)',
  'function institutionConfig() external view returns (string registrarName, string registrarSignatureURL, string viceChancellorName, string viceChancellorSignatureURL, string verificationDomain, string logoURL)',
  'function walletToPaxId(address student) external view returns (string)',
];

// ---------------------------------------------------------------------------
// AES-256-GCM Encryption — defined here inside the 'use client' module so
// Next.js never evaluates these functions during the server-side build pass.
// The key is deterministically derived from the university + student address
// so no key storage is needed — any client can re-derive it to verify.
// ---------------------------------------------------------------------------
const APP_SALT = 'pax-academic-certificate-system-v1';

function _toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function _fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Returns the SubtleCrypto instance. Accessed inside function bodies only
// so the build worker never evaluates this at module parse time.
function _subtle(): SubtleCrypto {
  // @ts-ignore - crypto is available at runtime in browser, not at build time
  return crypto.subtle;
}
function _randBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  // @ts-ignore - crypto is available at runtime in browser, not at build time
  crypto.getRandomValues(arr);
  return arr;
}

async function _deriveKey(universityAddress: string, studentAddress: string) {
  const raw = `${APP_SALT}:${universityAddress.toLowerCase()}:${studentAddress.toLowerCase()}`;
  const encoded = new TextEncoder().encode(raw);
  const hash = await _subtle().digest('SHA-256', encoded);
  return _subtle().importKey('raw', hash, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptField(plain: string, univAddr: string, studentAddr: string): Promise<string> {
  const key = await _deriveKey(univAddr, studentAddr);
  const iv = _randBytes(12);
  const cipher = await _subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return `enc:${_toBase64(iv)}:${_toBase64(new Uint8Array(cipher))}`;
}

async function decryptField(value: string, univAddr: string, studentAddr: string): Promise<string> {
  if (!value.startsWith('enc:')) return value;
  try {
    const parts = value.split(':');
    if (parts.length !== 3) return value;
    const key = await _deriveKey(univAddr, studentAddr);
    const iv = _fromBase64(parts[1]);
    const cipher = _fromBase64(parts[2]);
    const plain = await _subtle().decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch (_e) {
    return '[Encrypted]';
  }
}

type Msg = { type: 'success' | 'error' | 'info'; text: string };
type University = { address: string; name: string; deactivated: boolean; deactivationReason: string };

// Translate raw blockchain errors into human-readable messages
function parseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes('0xe2517d3f') || raw.includes('AccessControlUnauthorizedAccount')) {
    return 'Access denied. Your wallet does not have the required permission to perform this action. Only the programme administrator can authorise issuers or register programmes.';
  }
  if (raw.includes('Only the university admin') || raw.includes('Not a valid university contract')) {
    return 'Access denied. Only the programme administrator can authorise new issuers on this programme.';
  }
  if (raw.includes('user rejected') || raw.includes('User rejected')) {
    return 'You cancelled the transaction in MetaMask.';
  }
  if (raw.includes('insufficient funds')) {
    return 'Insufficient Sepolia ETH in your wallet. Please top up from a Sepolia faucet.';
  }
  if (raw.includes('already has a certificate') || raw.includes('This student already')) {
    return 'This student already has a certificate. Each student can only receive one certificate per university.';
  }
  if (raw.includes('network changed') || raw.includes('chain')) {
    return 'Network error. Please make sure you are on Sepolia Testnet in MetaMask.';
  }
  if (raw.includes('could not decode result data') || raw.includes('BAD_DATA')) {
    return 'Could not read data from this contract address. Please double-check the university contract address is correct.';
  }
  if (raw.includes('invalid address') || raw.includes('INVALID_ARGUMENT')) {
    return 'One of the addresses entered is invalid. Please check and try again.';
  }
  if (raw.includes('execution reverted')) {
    return 'Transaction failed on the blockchain. Please make sure all details are correct and try again.';
  }
  if (raw.includes('MetaMask not found')) {
    return 'MetaMask is not installed. Please install MetaMask to use this app.';
  }
  return 'Something went wrong. Please try again or check your wallet and network settings.';
}

export default function Dashboard() {
  const [account, setAccount] = useState('');
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  // 'owner'  = Pax Factory admin (full access)
  // 'admin'  = University DEFAULT_ADMIN_ROLE on at least one programme (issue + verify)
  // 'issuer' = ISSUER_ROLE on at least one programme (issue + verify)
  // 'none'   = wallet connected but no role found (verify only)
  const [walletRole, setWalletRole] = useState<'owner' | 'admin' | 'issuer' | 'none' | null>(null);
  const [activeTab, setActiveTab] = useState<'deploy' | 'issue' | 'verify'>('verify');
  const [msg, setMsg] = useState<Msg | null>(null);

  // Deploy tab
  const [univName, setUnivName] = useState('');
  const [univSymbol, setUnivSymbol] = useState('');
  const [univAdmin, setUnivAdmin] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUnivAddress, setDeployedUnivAddress] = useState('');

  // Issue tab
  const [univAddress, setUnivAddress] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(''); // Faculty for dean signature
  const [faculties, setFaculties] = useState<Array<{facultyName: string; deanName: string}>>([]);
  const [isLoadingFaculties, setIsLoadingFaculties] = useState(false);
  const [grade, setGrade] = useState('');
  const [paxId, setPaxId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [grantAddress, setGrantAddress] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [hasIssuerRole, setHasIssuerRole] = useState<boolean | null>(null);

  // Institution config (Register tab - step 2)
  const [configUnivAddress, setConfigUnivAddress] = useState('');
  const [deanName, setDeanName] = useState('');
  const [deanPosition, setDeanPosition] = useState('');
  const [registrarName, setRegistrarName] = useState('');
  const [registrarPosition, setRegistrarPosition] = useState('');
  const [vcName, setVcName] = useState('');
  const [vcPosition, setVcPosition] = useState('');
  const [verificationDomain, setVerificationDomain] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoURL, setLogoURL] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [isSettingConfig, setIsSettingConfig] = useState(false);

  // Signature system (Register tab - Step 2 redesigned)
  const [registrarSignatureURL, setRegistrarSignatureURL] = useState('');
  const [vcSignatureURL, setVcSignatureURL] = useState('');
  const [deanSignatureURL, setDeanSignatureURL] = useState('');
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [configuredFaculties, setConfiguredFaculties] = useState<Array<{ id: string; name: string; deanName: string; signatureURL: string }>>([]);
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyDean, setNewFacultyDean] = useState('');
  const [isSavingFaculty, setIsSavingFaculty] = useState(false);
  const registrarSignatureRef = useRef<any>(null);
  const vcSignatureRef = useRef<any>(null);
  const deanSignatureRef = useRef<any>(null);
  const currentFacultySignatureRef = useRef<any>(null);

  // Deactivation (owner only)
  const [deactivateAddress, setDeactivateAddress] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(''); // stores address being reactivated

  // Verify tab
  const [universities, setUniversities] = useState<University[]>([]);
  const [verifyUniv, setVerifyUniv] = useState('');
  const [verifyStudent, setVerifyStudent] = useState('');
  const [verifyPaxId, setVerifyPaxId] = useState('');
  const [verifyMode, setVerifyMode] = useState<'wallet' | 'paxid'>('wallet');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingUnis, setIsLoadingUnis] = useState(false);

  // Issue tab - only universities where connected wallet has admin or issuer role
  const [myUniversities, setMyUniversities] = useState<University[]>([]);
  const [isLoadingMyUnis, setIsLoadingMyUnis] = useState(false);
  const [certResult, setCertResult] = useState<{
    tokenId: string;
    candidateName: string;
    courseName: string;
    grade: string;
    paxId: string;
    issuedAt: string;
    universityName: string;
    univAddress: string;
    studentAddress: string;
    isRevoked: boolean;
    revocationReason: string;
    revocationDate: string;
    dean: string;
    deanSignature: string;
    deanPosition: string;
    registrar: string;
    registrarSignature: string;
    registrarPosition: string;
    vc: string;
    vcSignature: string;
    vcPosition: string;
    logoUrl: string;
    domain: string;
  } | null>(null);

  // Revocation state - Issue tab
  const REVOCATION_PRESETS = [
    'Academic misconduct — plagiarism detected',
    'Academic misconduct — cheating in examination',
    'Fraudulent application or falsified documents',
    'Certificate issued in error',
    'Degree requirements not fully met',
    'Administrative correction required',
  ];
  const [revokeAddress, setRevokeAddress] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [revokeEmail, setRevokeEmail] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const showMsg = (type: Msg['type'], text: string) => setMsg({ type, text });

  // Handle QR code deep-link — when someone scans a certificate QR code they land on
  // /?tab=verify&paxId=PHY/2019/054&contract=0x... — auto-fill, switch to verify tab,
  // and immediately run verification so the employer sees the result with zero interaction
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const paxIdParam = params.get('paxId');
    const contractParam = params.get('contract');
    if (tabParam === 'verify' && paxIdParam && contractParam && ethers.isAddress(contractParam)) {
      setActiveTab('verify');
      setVerifyMode('paxid');
      setVerifyPaxId(paxIdParam);
      setVerifyUniv(contractParam);
      // Delay to let state and RPC provider initialise before auto-verifying
      setIsVerifying(true);
      setTimeout(async () => {
        try {
          const provider = await getReadOnlyProvider();
          const university = new ethers.Contract(contractParam, UNIVERSITY_ABI, provider);
          const resolvedStudent = await university.resolvePaxId(paxIdParam.trim().toUpperCase());
          if (!resolvedStudent || resolvedStudent === ethers.ZeroAddress) return;
          const has = await university.hasCertificate(resolvedStudent);
          if (!has) return;
          const tokenId = await university.studentToTokenId(resolvedStudent);
          const [cert, revoked, reason, revDate] = await Promise.all([
            university.certificates(tokenId),
            university.isRevoked(resolvedStudent),
            university.revocationReason(resolvedStudent),
            university.revocationDate(resolvedStudent),
          ]);
          let univName;
          try { univName = await university.name(); } catch (_e) { univName = `Programme (${contractParam.slice(0, 8)}...)`; }
          // Fetch institution config for signatories and logo
          let config = { registrarName: '', registrarSignatureURL: '', viceChancellorName: '', viceChancellorSignatureURL: '', verificationDomain: '', logoURL: '' };
          try { config = await university.institutionConfig(); } catch (_e) { /* silent */ }
          // Fetch faculty signatories for dean signature
          let deanName = '', deanSignatureURL = '';
          try {
            const facs = await university.getFacultySignatories();
            if (facs.length > 0) { deanName = facs[0].deanName; deanSignatureURL = facs[0].deanSignatureURL; }
          } catch (_e) { /* silent */ }
          const [decryptedName, decryptedCourse, decryptedGrade] = await Promise.all([
            decryptField(cert.candidateName, contractParam, resolvedStudent),
            decryptField(cert.courseName, contractParam, resolvedStudent),
            decryptField(cert.grade, contractParam, resolvedStudent),
          ]);
          setCertResult({
            tokenId: tokenId.toString(),
            candidateName: decryptedName,
            courseName: decryptedCourse,
            grade: decryptedGrade,
            paxId: cert.paxId,
            issuedAt: new Date(Number(cert.issuanceDate) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            universityName: univName,
            univAddress: contractParam,
            studentAddress: resolvedStudent,
            isRevoked: revoked,
            revocationReason: reason,
            revocationDate: revoked && Number(revDate) > 0
              ? new Date(Number(revDate) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : '',
            dean: deanName,
            deanSignature: deanSignatureURL,
            registrar: config.registrarName || '',
            registrarSignature: config.registrarSignatureURL || '',
            vc: config.viceChancellorName || '',
            vcSignature: config.viceChancellorSignatureURL || '',
            logoUrl: config.logoURL || '',
            domain: config.verificationDomain || 'v0-paxadmin.vercel.app',
          });
          console.log('[v0] QR verification - certResult set:', {
            deanSignature: deanSignatureURL ? 'YES' : 'NO',
            registrarSignature: config.registrarSignatureURL ? 'YES' : 'NO',
            vcSignature: config.viceChancellorSignatureURL ? 'YES' : 'NO',
          });
          showMsg(revoked ? 'error' : 'success', revoked ? 'This certificate has been revoked.' : 'Certificate verified on the blockchain!');
        } catch (_e) { /* silent — user can manually hit Verify if auto fails */ }
        finally { setIsVerifying(false); }
      }, 800);
    }
  }, []);

  // Load all universities when verify tab opens (public)
  // Load public universities list on initial mount (before wallet connection)
  useEffect(() => {
    if (universities.length === 0 && !isLoadingUnis) {
      loadUniversities(true);
    }
  }, []);

  // Load universities for Verify tab (public — no wallet needed) or Issue tab (wallet-filtered)
  useEffect(() => {
    if (activeTab === 'verify') {
      loadUniversities(true); // Force refresh — publicly accessible, no wallet needed
    }
    if (activeTab === 'issue' && account) {
      loadMyUniversities(account);
    }
  }, [activeTab, account]);

  // Check if current wallet has issuer role when univAddress changes
  useEffect(() => {
    if (!account || !univAddress || !ethers.isAddress(univAddress)) {
      setHasIssuerRole(null);
      return;
    }
    checkIssuerRole();
  }, [account, univAddress]);

  const checkIssuerRole = async () => {
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, provider);
      const issuerRole = await university.ISSUER_ROLE();
      const hasRole = await university.hasRole(issuerRole, account);
      setHasIssuerRole(hasRole);
    } catch (_e) {
      setHasIssuerRole(null);
    }
  };

  // Static network object - passing this to JsonRpcProvider prevents ethers v6
  // from doing automatic network detection, which internally calls Tenderly and
  // other providers causing rate limit errors we have no control over.
  const SEPOLIA_NETWORK = { chainId: 11155111, name: 'sepolia' };

  const getReadOnlyProvider = async () => {
    const win = window as unknown as { ethereum?: object };
    // Prefer wallet provider (most reliable) - uses MetaMask directly
    if (win.ethereum) {
      return new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
    }
    // No wallet - try public RPCs with static network to skip ethers auto-detection
    const fallbackRpcs = [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://rpc.ankr.com/eth_sepolia',
      'https://sepolia.drpc.org',
      'https://1rpc.io/sepolia',
      'https://rpc2.sepolia.org',
      'https://rpc.sepolia.org',
    ];
    for (const rpc of fallbackRpcs) {
      try {
        // Pass SEPOLIA_NETWORK as second arg - this is the key fix.
        // Without it, ethers v6 calls multiple providers including Tenderly to detect the network.
        const p = new ethers.JsonRpcProvider(rpc, SEPOLIA_NETWORK, { staticNetwork: true });
        await p.getBlockNumber();
        return p;
      } catch (_e) {
        continue;
      }
    }
    throw new Error('Could not connect to Sepolia. Please install MetaMask or try again in a moment.');
  };

  const loadUniversities = async (force = false, role?: string) => {
    // Return cached list instantly if already loaded — avoids repeated RPC calls on tab switches
    if (!force && universities.length > 0) return;
    setIsLoadingUnis(true);
    try {
      const provider = await getReadOnlyProvider();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

      // Owner sees ALL universities (including deactivated) for management
      // Everyone else (including unauthenticated visitors) only sees active universities
      const effectiveRole = role ?? walletRole;
      let addresses: string[] = [];
      try {
        if (effectiveRole === 'owner') {
          addresses = await factory.getAllUniversities();
        } else {
          addresses = await factory.getActiveUniversities();
        }
      } catch (_e) {
        // Fallback for older factory deployments that lack these methods
        try {
          const count = await factory.getUniversityCount();
          const addressPromises = Array.from({ length: Number(count) }, (_, i) =>
            factory.deployedUniversities(i)
          );
          addresses = await Promise.all(addressPromises);
        } catch (_e2) {
          // Factory unreachable or wrong network — silently return empty list
          addresses = [];
        }
      }

      // Fetch names + deactivation status in parallel
      const unis = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const univContract = new ethers.Contract(addr, UNIVERSITY_ABI, provider);
            const [name, deactivated, reason] = await Promise.all([
              univContract.name(),
              factory.isDeactivated(addr),
              factory.deactivationReason(addr).catch(() => ''),
            ]);
            return { address: addr, name, deactivated: deactivated as boolean, deactivationReason: reason as string };
          } catch (_e) {
            return { address: addr, name: `University (${addr.slice(0, 6)}...)`, deactivated: false, deactivationReason: '' };
          }
        })
      );
      setUniversities(unis);
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Could not load universities. Please try again.');
    } finally {
      setIsLoadingUnis(false);
    }
  };

  const loadMyUniversities = async (walletAddress: string) => {
    if (!walletAddress) return;
    setIsLoadingMyUnis(true);
    try {
      const provider = await getReadOnlyProvider();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

      // Single call to the Factory - returns only the contracts this wallet has access to.
      // This replaces the old loop that made 4 RPC calls per university contract.
      const addresses: string[] = await factory.getWalletUniversities(walletAddress);

      if (addresses.length === 0) {
        setMyUniversities([]);
        return;
      }

      // Fetch name AND deactivation status in parallel for every university
      // Filter out deactivated ones — issuers should never see or use them
      const results = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const univContract = new ethers.Contract(addr, UNIVERSITY_ABI, provider);
            const [name, deactivated] = await Promise.all([
              univContract.name(),
              factory.isDeactivated(addr),
            ]);
            return { address: addr, name, deactivated: deactivated as boolean, deactivationReason: '' };
          } catch (_e) {
            return { address: addr, name: `University (${addr.slice(0, 6)}...)`, deactivated: false, deactivationReason: '' };
          }
        })
      );

      // Only show active institutions in the Issue tab dropdown
      const activeOnly = results.filter((u) => !u.deactivated);
      setMyUniversities(activeOnly);
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Could not load your universities. Please try again.');
    } finally {
      setIsLoadingMyUnis(false);
    }
  };

  const detectRole = async (walletAddress: string) => {
    try {
      const provider = await getReadOnlyProvider();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

      // Check if this wallet is the Pax Factory owner (DEFAULT_ADMIN_ROLE on Factory)
      const adminRole = await factory.DEFAULT_ADMIN_ROLE();
      const isPaxOwner = await factory.hasRole(adminRole, walletAddress);
      if (isPaxOwner) {
        setWalletRole('owner');
        setActiveTab('deploy'); // Owner lands on Register Programme
        return;
      }

      // Check if this wallet is a University Admin or Issuer on any programme
      const walletUnivs: string[] = await factory.getWalletUniversities(walletAddress);
      if (walletUnivs.length === 0) {
        setWalletRole('none');
        setActiveTab('verify'); // No role — verify only
        return;
      }

      // Check role on first associated university to distinguish admin vs issuer
      const univContract = new ethers.Contract(walletUnivs[0], UNIVERSITY_ABI, provider);
      const defaultAdminRole = await univContract.DEFAULT_ADMIN_ROLE();
      const isAdmin = await univContract.hasRole(defaultAdminRole, walletAddress);
      if (isAdmin) {
        setWalletRole('admin');
        setActiveTab('issue'); // Admin lands on Issue tab
        return;
      }

      // Must be an issuer
      setWalletRole('issuer');
      setActiveTab('issue'); // Issuer lands on Issue tab
    } catch (_e) {
      setWalletRole('none');
      setActiveTab('verify');
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const win = window as unknown as {
        ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
      };
      if (!win.ethereum) throw new Error('MetaMask not found');

      const accounts = (await win.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const chainIdHex = (await win.ethereum.request({ method: 'eth_chainId' })) as string;
      const chainIdNum = parseInt(chainIdHex, 16);

      if (chainIdNum !== SEPOLIA_CHAIN_ID) {
        showMsg('info', 'Switching to Sepolia network...');
        try {
          await win.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_HEX }] });
        } catch (_e) {
          await win.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_HEX,
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
        }
      }

      const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
      const s = await provider.getSigner();
      setSigner(s);
      setAccount(accounts[0]);
      showMsg('success', 'Wallet connected to Sepolia!');
      // Detect role and load universities in parallel — detectRole sets the active tab
      await Promise.all([
        detectRole(accounts[0]),
        loadMyUniversities(accounts[0]),
      ]);
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const deployUniversity = async () => {
    if (!univName || !univSymbol || !univAdmin) { showMsg('error', 'Please fill in all fields before deploying.'); return; }
    if (!ethers.isAddress(univAdmin)) { showMsg('error', 'Programme Administrator Wallet is not a valid address.'); return; }
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    setIsDeploying(true);
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      
      // Check if connected wallet has FACTORY_ADMIN_ROLE
      const factoryAdminRole = await factory.FACTORY_ADMIN_ROLE();
      const hasFactoryAdminRole = await factory.hasRole(factoryAdminRole, account);
      console.log('[v0] FACTORY_ADMIN_ROLE check:', { role: factoryAdminRole, account, hasRole: hasFactoryAdminRole });
      
      if (!hasFactoryAdminRole) {
        showMsg('error', 'Your connected wallet does not have FACTORY_ADMIN_ROLE. Only the Pax owner who deployed the Factory can register programmes.');
        setIsDeploying(false);
        return;
      }
      
      showMsg('info', 'Deploying institution contract... Please confirm in MetaMask.');
      // Checksum the admin address to ensure correct format
      const checksummedAdmin = ethers.getAddress(univAdmin);
      console.log('[v0] Deploying with:', { univName: univName.trim(), univSymbol, checksummedAdmin, yourWallet: account });
      const tx = await factory.deployUniversity(univName.trim(), univSymbol, checksummedAdmin, BASE_METADATA_URI);
      console.log('[v0] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      const univAddr = receipt?.logs[0]?.address || receipt?.to;
      setDeployedUnivAddress(univAddr);
      showMsg('success', `Institution registered! Contract: ${univAddr}`);
    } catch (error) {
      console.error('[v0] Deploy error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a permission error
      if (errorMsg.includes('execution reverted')) {
        showMsg('error', 'Contract execution failed. Please verify: 1) Your wallet has FACTORY_ADMIN_ROLE, 2) The institution admin address is valid.');
      } else {
        showMsg('error', parseError(error));
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const grantIssuerRole = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univAddress) { showMsg('error', 'Please enter the university contract address.'); return; }
    if (!ethers.isAddress(univAddress)) { showMsg('error', 'The university contract address is not valid.'); return; }
    if (!grantAddress) { showMsg('error', 'Please enter the wallet address you want to grant the Issuer Role to.'); return; }
    if (!ethers.isAddress(grantAddress)) { showMsg('error', 'The wallet address to grant role to is not valid.'); return; }
    setIsGranting(true);
    try {
      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, signer);

      // Check if the current wallet is admin before trying
      const adminRole = await university.DEFAULT_ADMIN_ROLE();
      const isAdmin = await university.hasRole(adminRole, account);
      if (!isAdmin) {
        showMsg('error', 'Your wallet is not the admin of this university contract. Only the admin wallet that was set during deployment can grant roles.');
        setIsGranting(false);
        return;
      }

      const issuerRole = await university.ISSUER_ROLE();
      showMsg('info', 'Granting Issuer Role... Please confirm in MetaMask.');
      const tx = await university.grantRole(issuerRole, grantAddress);
      await tx.wait();

      // Register the issuer in the Factory so their wallet appears in the Issue tab dropdown.
      // This is the key step that makes getWalletUniversities() work for the new issuer.
      showMsg('info', 'Registering issuer in Factory... Please confirm in MetaMask.');
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const registerTx = await factory.registerIssuer(univAddress, grantAddress);
      await registerTx.wait();

      setHasIssuerRole(grantAddress.toLowerCase() === account.toLowerCase() ? true : hasIssuerRole);
      showMsg('success', `Issuer Role granted to ${grantAddress.slice(0, 6)}...${grantAddress.slice(-4)}. They can now issue certificates on this programme.`);
      // Refresh the wallet's university list in case the grantee is the current wallet
      await loadMyUniversities(account);
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsGranting(false);
    }
  };

  // Upload signature image to Blob storage via API
  const uploadSignatureToBlob = async (signatureDataURL: string): Promise<string> => {
    try {
      setIsUploadingSignature(true);
      console.log('[v0] Starting signature upload');
      
      // Call API endpoint to upload (server has BLOB_READ_WRITE_TOKEN)
      console.log('[v0] Calling /api/upload-signature');
      const response = await fetch('/api/upload-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: signatureDataURL }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[v0] API error response:', errorData);
        throw new Error(errorData.error || errorData.details || 'Upload failed');
      }

      const { url } = await response.json();
      console.log('[v0] Signature uploaded successfully:', url);
      return url;
    } catch (error) {
      console.error('[v0] Signature upload failed:', error);
      throw new Error(`Failed to upload signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    try {
      console.log('[v0] uploadLogo - Starting, file:', file.name, 'size:', file.size, 'type:', file.type);
      
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          console.log('[v0] uploadLogo - Base64 length:', result.length);
          resolve(result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
      
      reader.readAsDataURL(file);
      const imageData = await base64Promise;
      
      console.log('[v0] uploadLogo - Calling /api/upload-logo with base64 data');
      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData }),
      });
      
      console.log('[v0] uploadLogo - Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[v0] uploadLogo - Server error:', res.status, errorData);
        throw new Error(`Logo upload failed: ${errorData.error || res.statusText}`);
      }
      
      const { url } = await res.json();
      console.log('[v0] uploadLogo - Success:', url);
      return url;
    } catch (error) {
      console.error('[v0] uploadLogo - Error:', error);
      throw error;
    }
  };

  // Save core signatories (Registrar + Vice-Chancellor + Dean)
  const saveInstitutionConfig = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!configUnivAddress || !ethers.isAddress(configUnivAddress)) { showMsg('error', 'Please enter a valid programme contract address.'); return; }
    
    // Debug which fields are empty
    console.log('[v0] Validation check:', {
      registrarName: registrarName ? '✓' : '✗ EMPTY',
      registrarSignatureURL: registrarSignatureURL ? '✓' : '✗ EMPTY',
      vcName: vcName ? '✓' : '✗ EMPTY',
      vcSignatureURL: vcSignatureURL ? '✓' : '✗ EMPTY',
      deanName: deanName ? '✓' : '✗ EMPTY',
      deanSignatureURL: deanSignatureURL ? '✓' : '✗ EMPTY',
    });
    
    if (!registrarName || !registrarSignatureURL || !vcName || !vcSignatureURL || !deanName || !deanSignatureURL) { 
      showMsg('error', 'Please fill in all signatory names and draw their signatures.'); 
      return; 
    }
    setIsSettingConfig(true);
    let finalLogoURL = logoURL;
    try {
      // Upload logo if provided - but don't block if it fails
      if (logoFile) {
        setLogoUploading(true);
        showMsg('info', 'Uploading institution logo...');
        try {
          finalLogoURL = await uploadLogo(logoFile);
          setLogoURL(finalLogoURL);
          console.log('[v0] Logo uploaded successfully:', finalLogoURL);
        } catch (logoError) {
          console.warn('[v0] Logo upload failed, continuing without logo:', logoError);
          showMsg('warning', `Logo upload failed, saving signatories without logo: ${logoError instanceof Error ? logoError.message : 'Unknown error'}`);
          finalLogoURL = ''; // Continue with empty logo URL
        } finally {
          setLogoUploading(false);
        }
      }

      const university = new ethers.Contract(configUnivAddress, UNIVERSITY_ABI, signer);
      showMsg('info', 'Saving institution signatories... Please confirm in MetaMask.');
      const tx = await university.setInstitutionConfig(registrarName, registrarSignatureURL, vcName, vcSignatureURL, deanName, deanSignatureURL, verificationDomain, finalLogoURL);
      await tx.wait();
      showMsg('success', 'Core signatories saved! Now add faculties below.');
      setRegistrarName(''); setVcName(''); setDeanName(''); setRegistrarSignatureURL(''); setVcSignatureURL(''); setDeanSignatureURL(''); setVerificationDomain(''); setLogoFile(null); setLogoURL('');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsSettingConfig(false);
      setLogoUploading(false);
    }
  };

  // Save Registrar signature
  const saveRegistrarSignature = async () => {
    console.log('[v0] saveRegistrarSignature called');
    if (!registrarSignatureRef.current || registrarSignatureRef.current.isEmpty()) {
      console.log('[v0] Registrar canvas is empty');
      showMsg('error', 'Please draw the registrar\'s signature.');
      return;
    }
    try {
      console.log('[v0] Getting registrar signature data');
      showMsg('info', 'Uploading registrar signature...');
      const signatureDataURL = registrarSignatureRef.current.toDataURL();
      console.log('[v0] Got data URL, length:', signatureDataURL.length);
      const url = await uploadSignatureToBlob(signatureDataURL);
      console.log('[v0] Registrar signature URL:', url);
      setRegistrarSignatureURL(url);
      showMsg('success', 'Registrar signature saved!');
    } catch (error) {
      console.error('[v0] Error saving registrar signature:', error);
      showMsg('error', `Failed to save registrar signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Save Vice-Chancellor signature
  const saveVCSignature = async () => {
    console.log('[v0] saveVCSignature called');
    if (!vcSignatureRef.current || vcSignatureRef.current.isEmpty()) {
      console.log('[v0] VC canvas is empty');
      showMsg('error', 'Please draw the vice-chancellor\'s signature.');
      return;
    }
    try {
      console.log('[v0] Getting VC signature data');
      showMsg('info', 'Uploading vice-chancellor signature...');
      const signatureDataURL = vcSignatureRef.current.toDataURL();
      console.log('[v0] Got data URL, length:', signatureDataURL.length);
      const url = await uploadSignatureToBlob(signatureDataURL);
      console.log('[v0] VC signature URL:', url);
      setVcSignatureURL(url);
      showMsg('success', 'Vice-Chancellor signature saved!');
    } catch (error) {
      console.error('[v0] Error saving VC signature:', error);
      showMsg('error', `Failed to save VC signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Save Dean signature
  const saveDeanSignature = async () => {
    console.log('[v0] saveDeanSignature called');
    if (!deanSignatureRef.current || deanSignatureRef.current.isEmpty()) {
      console.log('[v0] Dean canvas is empty');
      showMsg('error', 'Please draw the dean\'s signature.');
      return;
    }
    try {
      console.log('[v0] Getting dean signature data');
      showMsg('info', 'Uploading dean signature...');
      const signatureDataURL = deanSignatureRef.current.toDataURL();
      console.log('[v0] Got data URL, length:', signatureDataURL.length);
      const url = await uploadSignatureToBlob(signatureDataURL);
      console.log('[v0] Dean signature URL:', url);
      setDeanSignatureURL(url);
      showMsg('success', 'Dean signature saved!');
    } catch (error) {
      console.error('[v0] Error saving dean signature:', error);
      showMsg('error', `Failed to save dean signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add or update a faculty signatory
  const addFacultySignatory = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!configUnivAddress || !ethers.isAddress(configUnivAddress)) { showMsg('error', 'Please enter a valid programme contract address first.'); return; }
    if (!newFacultyName || !newFacultyDean) { showMsg('error', 'Please fill in faculty name and dean name.'); return; }
    
    // Get faculty signature from canvas
    if (!currentFacultySignatureRef.current || currentFacultySignatureRef.current.isEmpty()) {
      showMsg('error', 'Please draw the dean\'s signature.'); 
      return;
    }

    setIsSavingFaculty(true);
    try {
      showMsg('info', 'Uploading dean signature...');
      const signatureDataURL = currentFacultySignatureRef.current.toDataURL();
      const signatureURL = await uploadSignatureToBlob(signatureDataURL);

      const university = new ethers.Contract(configUnivAddress, UNIVERSITY_ABI, signer);
      showMsg('info', 'Saving faculty signatory... Please confirm in MetaMask.');
      const tx = await university.setFacultySignatory(newFacultyName, newFacultyDean, signatureURL);
      await tx.wait();

      // Add to local list
      setConfiguredFaculties([...configuredFaculties, { id: Date.now().toString(), name: newFacultyName, deanName: newFacultyDean, signatureURL }]);
      showMsg('success', `${newFacultyName} with Dean ${newFacultyDean} added successfully!`);
      
      // Clear form
      setNewFacultyName('');
      setNewFacultyDean('');
      if (currentFacultySignatureRef.current) currentFacultySignatureRef.current.clear();
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsSavingFaculty(false);
    }
  };

  const handleDeactivate = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!ethers.isAddress(deactivateAddress)) { showMsg('error', 'Please enter a valid university contract address.'); return; }
    if (!deactivateReason.trim()) { showMsg('error', 'Please provide a reason for deactivation.'); return; }
    setIsDeactivating(true);
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const isValid = await factory.isUniversityContract(deactivateAddress);
      if (!isValid) { showMsg('error', 'This address is not a valid university contract from this factory.'); return; }
      const alreadyDeactivated = await factory.isDeactivated(deactivateAddress);
      if (alreadyDeactivated) { showMsg('error', 'This institution is already deactivated.'); return; }
      showMsg('info', 'Deactivating institution... Please confirm in MetaMask.');
      const tx = await factory.deactivateUniversity(deactivateAddress, deactivateReason.trim());
      await tx.wait();
      showMsg('success', 'Institution deactivated. They can no longer issue certificates. Existing certificates remain verifiable.');
      setDeactivateAddress('');
      setDeactivateReason('');
      await loadUniversities(true, 'owner');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (addr: string) => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    setIsReactivating(addr);
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      showMsg('info', 'Reactivating institution... Please confirm in MetaMask.');
      const tx = await factory.reactivateUniversity(addr);
      await tx.wait();
      showMsg('success', 'Institution reactivated. They can now issue certificates again.');
      await loadUniversities(true, 'owner');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsReactivating('');
    }
  };

  const handleRevoke = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univAddress) { showMsg('error', 'Please select a programme first.'); return; }
    if (!ethers.isAddress(revokeAddress)) { showMsg('error', 'Please enter a valid student wallet address.'); return; }
    const finalReason = revokeReason === 'custom' ? customReason.trim() : revokeReason;
    if (!finalReason) { showMsg('error', 'Please select or enter a revocation reason.'); return; }
    if (revokeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(revokeEmail)) {
      showMsg('error', 'Please enter a valid email address or leave it blank.'); return;
    }
    setIsRevoking(true);
    try {
      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, signer);
      const has = await university.hasCertificate(revokeAddress);
      if (!has) { showMsg('error', 'This wallet does not have a certificate on the selected programme.'); return; }
      const alreadyRevoked = await university.isRevoked(revokeAddress);
      if (alreadyRevoked) { showMsg('error', 'This certificate has already been revoked.'); return; }
      showMsg('info', 'Revoking certificate... Please confirm in MetaMask.');
      const tx = await university.revokeCertificate(revokeAddress, finalReason);
      await tx.wait();
      showMsg('success', `Certificate revoked. Reason recorded permanently on blockchain: "${finalReason}"`);

      // Send revocation email if provided
      if (revokeEmail) {
        showMsg('info', 'Sending revocation notification email...');
        try {
          // Fetch certificate details for the email
          const tokenId = await university.studentToTokenId(revokeAddress);
          const cert = await university.certificates(tokenId);
          const univName = myUniversities.find(u => u.address.toLowerCase() === univAddress.toLowerCase())?.name || 'Your Institution';
          const decryptedName = await decryptField(cert.candidateName, univAddress, revokeAddress);
          const decryptedCourse = await decryptField(cert.courseName, univAddress, revokeAddress);

          await fetch('/api/certificate/send-revocation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: revokeEmail,
              studentName: decryptedName,
              course: decryptedCourse,
              paxId: cert.paxId,
              universityName: univName,
              reason: finalReason,
              revokedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            }),
          });
          showMsg('success', `Revocation email sent to ${revokeEmail}`);
        } catch (_e) {
          showMsg('error', 'Certificate revoked but email notification failed to send.');
        }
      }

      setRevokeAddress('');
      setRevokeReason('');
      setCustomReason('');
      setRevokeEmail('');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsRevoking(false);
    }
  };

  // Fetch faculties when university address is selected in Issue tab
  const loadFacultiesForIssue = async (address: string) => {
    if (!address || !ethers.isAddress(address)) {
      setFaculties([]);
      setSelectedFaculty('');
      return;
    }
    setIsLoadingFaculties(true);
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(address, UNIVERSITY_ABI, provider);
      const facultyList = await university.getFacultySignatories();
      console.log('[v0] Fetched faculties:', facultyList);
      setFaculties(facultyList);
      setSelectedFaculty(''); // Reset selection when new university is picked
    } catch (error) {
      console.error('[v0] Failed to fetch faculties:', error);
      setFaculties([]);
      setSelectedFaculty('');
    } finally {
      setIsLoadingFaculties(false);
    }
  };

  // Call loadFacultiesForIssue when univAddress changes
  useEffect(() => {
    loadFacultiesForIssue(univAddress);
  }, [univAddress]);

  const issueCertificate = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univAddress || !studentAddress || !certificateName || !courseName || !selectedFaculty || !grade || !paxId) {
      showMsg('error', 'Please fill in all fields including faculty, grade, and PaxID before issuing a certificate.'); return;
    }
    if (!ethers.isAddress(univAddress)) { showMsg('error', 'The university contract address is not valid.'); return; }
    if (!ethers.isAddress(studentAddress)) { showMsg('error', 'The student wallet address is not valid.'); return; }
    if (studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      showMsg('error', 'Please enter a valid student email address or leave it blank.'); return;
    }
    // PaxID is stored as-is but looked up case-insensitively — enforce uppercase for issuers
    const normalisedPaxId = paxId.toUpperCase().trim();
    setIsIssuing(true);
    try {
      // Encrypt name, course, and grade before storing on blockchain
      showMsg('info', 'Encrypting certificate data...');
      const encryptedName = await encryptField(certificateName, univAddress, studentAddress);
      const encryptedCourse = await encryptField(courseName, univAddress, studentAddress);
      const encryptedGrade = await encryptField(grade, univAddress, studentAddress);

      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, signer);
      showMsg('info', 'Issuing certificate... Please confirm in MetaMask.');
      // Log masked data for GDPR compliance - useful for debugging without exposing PII
      logGDPRCompliant('Certificate issuance', {
        student: studentAddress,
        name: certificateName,
        course: courseName,
        grade: grade,
        paxId: normalisedPaxId,
        selectedFaculty: selectedFaculty,
      });
      const tx = await university.issueCertificate(studentAddress, encryptedName, encryptedCourse, encryptedGrade, normalisedPaxId);
      console.log('[v0] Transaction sent:', tx.hash);
      const receipt = await tx.wait();

      showMsg('success', `Certificate issued to ${certificateName}! PaxID: ${normalisedPaxId}`);

      // Send email softcopy if email was provided — fire and forget, never store it
      if (studentEmail) {
        showMsg('info', 'Sending certificate to student email...');
        try {
          const univName = myUniversities.find(u => u.address.toLowerCase() === univAddress.toLowerCase())?.name || 'Your Institution';
          
          // Fetch institution config to get signatories and logo for email certificate
          let registrarSignature = '', vcSignature = '', deanSignature = '', logoUrl = '', registrarName = '', vcName = '', deanName = '';
          try {
            const provider = await getReadOnlyProvider();
            const universityContract = new ethers.Contract(univAddress, UNIVERSITY_ABI, provider);
            const config = await universityContract.institutionConfig();
            registrarName = config.registrarName || '';
            registrarSignature = config.registrarSignatureURL || '';
            vcName = config.viceChancellorName || '';
            vcSignature = config.viceChancellorSignatureURL || '';
            logoUrl = config.logoURL || '';
            
            // Get dean signature for selected faculty
            try {
              const faculties = await universityContract.getFacultySignatories();
              const selectedFac = faculties.find((f: any) => f.facultyName.toLowerCase() === selectedFaculty.toLowerCase());
              if (selectedFac) {
                deanName = selectedFac.deanName;
                deanSignature = selectedFac.deanSignatureURL;
              }
            } catch (_e) {
              // Faculty not found, continue with empty dean signature
            }
          } catch (_e) {
            // Silent — if config fetch fails, email will use defaults (empty signatories)
          }

          await fetch('/api/certificate/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: studentEmail,
              studentName: certificateName,
              course: courseName,
              grade,
              paxId: normalisedPaxId,
              universityName: univName,
              studentAddress,
              contractAddress: univAddress,
              registrar: registrarName,
              registrarSignature,
              registrarPosition,
              vc: vcName,
              vcSignature,
              vcPosition,
              dean: deanName,
              deanSignature,
              deanPosition,
              logoUrl,
              domain: 'verify.example.edu',
            }),
          }).then(res => {
            if (res.ok) {
              showMsg('success', `Certificate email sent to ${studentEmail}!`);
            } else {
              console.error('[v0] Email send failed with status:', res.status);
              showMsg('warning', 'Certificate issued but email failed to send. The blockchain record is safe.');
            }
          });
        } catch (_e) {
          console.error('[v0] Email send error (continuing):', _e);
          showMsg('warning', 'Certificate issued but email failed to send. The blockchain record is safe.');
        }
      }
    } catch (error) {
      console.error('[v0] Certificate issuance error:', error);
      if (error instanceof Error) {
        console.error('[v0] Error message:', error.message);
        console.error('[v0] Full error:', JSON.stringify(error, null, 2));
      }
      showMsg('error', parseError(error));
    } finally {
      setIsIssuing(false);
    }
  };

  const verifyCertificate = async () => {
    if (!verifyUniv) { showMsg('error', 'Please select a university.'); return; }
    setIsVerifying(true);
    setCertResult(null);
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(verifyUniv, UNIVERSITY_ABI, provider);

      // Resolve student address — either from direct wallet input or PaxID lookup
      let resolvedStudent = verifyStudent;
      if (verifyMode === 'paxid') {
        if (!verifyPaxId.trim()) { showMsg('error', 'Please enter a PaxID.'); setIsVerifying(false); return; }
        // Normalise to uppercase before lookup — issuers always store uppercase,
        // but students/employers may type it in any case
        resolvedStudent = await university.resolvePaxId(verifyPaxId.trim().toUpperCase());
        if (!resolvedStudent || resolvedStudent === ethers.ZeroAddress) {
          showMsg('error', `No certificate found for PaxID "${verifyPaxId}".`);
          setIsVerifying(false);
          return;
        }
      } else {
        if (!verifyStudent) { showMsg('error', 'Please enter the student wallet address.'); setIsVerifying(false); return; }
        if (!ethers.isAddress(verifyStudent)) { showMsg('error', 'The student wallet address is not valid.'); setIsVerifying(false); return; }
      }

      const has = await university.hasCertificate(resolvedStudent);
      if (!has) {
        showMsg('error', 'No certificate found for this student at the selected university.');
        setIsVerifying(false);
        return;
      }

      const tokenId = await university.studentToTokenId(resolvedStudent);
      const [cert, revoked, reason, revDate] = await Promise.all([
        university.certificates(tokenId),
        university.isRevoked(resolvedStudent),
        university.revocationReason(resolvedStudent),
        university.revocationDate(resolvedStudent),
      ]);

      // Resolve university name — first try the loaded state, then fall back to
      // reading it directly from the contract (important when arriving via QR code
      // with no wallet connected and universities state is empty)
      let univName = universities.find(u => u.address.toLowerCase() === verifyUniv.toLowerCase())?.name;
      if (!univName) {
        try { univName = await university.name(); } catch (_e) { univName = `Programme (${verifyUniv.slice(0, 8)}...)`; }
      }

      // Fetch institution config for signatories and logo
      let institutionConfig = { registrarName: '', registrarSignatureURL: '', viceChancellorName: '', viceChancellorSignatureURL: '', verificationDomain: '', logoURL: '' };
      try {
        institutionConfig = await university.institutionConfig();
      } catch (_e) { /* Silent — institution config may not be set */ }

      // Fetch faculty signatories for dean signature
      let deanName = '', deanSignatureURL = '';
      try {
        const facs = await university.getFacultySignatories();
        if (facs.length > 0) { deanName = facs[0].deanName; deanSignatureURL = facs[0].deanSignatureURL; }
      } catch (_e) { /* silent */ }

      const [decryptedName, decryptedCourse, decryptedGrade] = await Promise.all([
        decryptField(cert.candidateName, verifyUniv, resolvedStudent),
        decryptField(cert.courseName, verifyUniv, resolvedStudent),
        decryptField(cert.grade, verifyUniv, resolvedStudent),
      ]);

      setCertResult({
        tokenId: tokenId.toString(),
        candidateName: decryptedName,
        courseName: decryptedCourse,
        grade: decryptedGrade,
        paxId: cert.paxId,
        issuedAt: new Date(Number(cert.issuanceDate) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        universityName: univName,
        univAddress: verifyUniv,
        studentAddress: resolvedStudent,
        isRevoked: revoked,
        revocationReason: reason,
        revocationDate: revoked && Number(revDate) > 0
          ? new Date(Number(revDate) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '',
        dean: deanName,
        deanSignature: deanSignatureURL,
        registrar: institutionConfig.registrarName || '',
        registrarSignature: institutionConfig.registrarSignatureURL || '',
        vc: institutionConfig.viceChancellorName || '',
        vcSignature: institutionConfig.viceChancellorSignatureURL || '',
        logoUrl: institutionConfig.logoURL || '',
        domain: institutionConfig.verificationDomain || 'v0-paxadmin.vercel.app',
      });
      console.log('[v0] Manual verification - certResult set:', {
        deanSignature: deanSignatureURL ? 'YES' : 'NO',
        registrarSignature: institutionConfig.registrarSignatureURL ? 'YES' : 'NO',
        vcSignature: institutionConfig.viceChancellorSignatureURL ? 'YES' : 'NO',
      });
      showMsg(revoked ? 'error' : 'success', revoked ? 'This certificate has been revoked by the issuing institution.' : 'Certificate verified on the blockchain!');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1';
  const btnClass = 'w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm';

  return (
    <main className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">PAX Certificate System</h1>
            <p className="text-xs text-slate-400">Blockchain-Verified Academic Credentials</p>
          </div>
          <div className="flex items-center gap-2">
            {account && walletRole && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                walletRole === 'owner'  ? 'bg-yellow-900/40 border-yellow-600 text-yellow-300' :
                walletRole === 'admin'  ? 'bg-purple-900/40 border-purple-600 text-purple-300' :
                walletRole === 'issuer' ? 'bg-blue-900/40 border-blue-600 text-blue-300' :
                'bg-slate-700 border-slate-600 text-slate-400'
              }`}>
                {walletRole === 'owner' ? 'Pax Owner' : walletRole === 'admin' ? 'Admin' : walletRole === 'issuer' ? 'Issuer' : 'Verifier'}
              </span>
            )}
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${account ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
            >
              {isConnecting ? 'Connecting...' : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
            </button>
            {account && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(account);
                  showMsg('success', 'Wallet address copied to clipboard!');
                }}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-all text-slate-300 hover:text-white"
                title="Copy wallet address"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Message Banner */}
        {msg && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium flex justify-between items-start gap-4 ${
            msg.type === 'success' ? 'bg-green-900/40 border border-green-600 text-green-200' :
            msg.type === 'error' ? 'bg-red-900/40 border border-red-600 text-red-200' :
            'bg-blue-900/40 border border-blue-600 text-blue-200'
          }`}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="shrink-0 opacity-60 hover:opacity-100 text-lg leading-none">x</button>
          </div>
        )}

        {/* Tabs — visibility depends on connected wallet role */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg mb-8 border border-slate-700">
          {(['deploy', 'issue', 'verify'] as const).map((tab) => {
            // Determine if this tab is accessible to the current wallet
            const canAccess =
              tab === 'verify' ? true : // always open
              tab === 'deploy' ? walletRole === 'owner' :
              tab === 'issue' ? (walletRole === 'owner' || walletRole === 'admin' || walletRole === 'issuer') :
              false;

            return (
              <button
                key={tab}
                onClick={() => { if (canAccess) { setActiveTab(tab); setMsg(null); } }}
                disabled={!canAccess}
                title={!canAccess && !account ? 'Connect your wallet to access this tab' : !canAccess ? 'Your wallet does not have permission to access this tab' : undefined}
                className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all
                  ${activeTab === tab ? 'bg-blue-600 text-white shadow' : ''}
                  ${canAccess ? 'text-slate-300 hover:text-white cursor-pointer' : 'text-slate-600 cursor-not-allowed opacity-40'}
                `}
              >
                {tab === 'deploy' ? 'Register Programme' : tab === 'issue' ? 'Issue Certificate' : 'Verify Certificate'}
              </button>
            );
          })}
        </div>

        {/* Access guard — shown when a tab is active but wallet has no permission */}
        {activeTab === 'deploy' && walletRole !== 'owner' && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-300">Access Restricted</h2>
            <p className="text-slate-500 text-sm max-w-xs">
              {!account
                ? 'Please connect your wallet to access this section.'
                : 'This section is only available to the Pax platform owner. Your wallet does not have the required permission.'}
            </p>
            {!account && (
              <button onClick={connectWallet} className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold">
                Connect Wallet
              </button>
            )}
          </div>
        )}

        {activeTab === 'issue' && !account && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-300">Connect Your Wallet</h2>
            <p className="text-slate-500 text-sm max-w-xs">You need to connect a wallet with Issuer or Admin permission to issue certificates.</p>
            <button onClick={connectWallet} className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold">
              Connect Wallet
            </button>
          </div>
        )}

        {activeTab === 'issue' && account && walletRole === 'none' && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="text-lg font-bold text-slate-300">No Permission Found</h2>
            <p className="text-slate-500 text-sm max-w-xs">Your connected wallet ({account.slice(0, 6)}...{account.slice(-4)}) does not have Issuer or Admin access on any programme. Contact your institution administrator.</p>
          </div>
        )}

        {/* Deploy University Tab */}
        {activeTab === 'deploy' && walletRole === 'owner' && (
          <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
            <div>
              <h2 className="text-lg font-bold">Register a New Programme</h2>
              <p className="text-slate-400 text-sm mt-1">Register your institution and degree programme to begin issuing verified certificates.</p>
            </div>
            <div>
              <label className={labelClass}>Institution Name</label>
              <input className={inputClass} placeholder="e.g. University of Lagos" value={univName} onChange={(e) => setUnivName(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">Your institution's official name. You&apos;ll add different faculties and degree levels in Step 2 (no need to create separate programmes).</p>
            </div>
            <div>
              <label className={labelClass}>Certificate Identifier</label>
              <input className={inputClass} placeholder="e.g. UNILAG" value={univSymbol} onChange={(e) => setUnivSymbol(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">A short unique code for this institution (2-6 characters, e.g. UNILAG, HARV)</p>
            </div>
            <div>
              <label className={labelClass}>Programme Administrator Wallet</label>
              <input className={inputClass} placeholder="0x..." value={univAdmin} onChange={(e) => setUnivAdmin(e.target.value)} />
              {account && (
                <button onClick={() => setUnivAdmin(account)} className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline">
                  Use my connected wallet ({account.slice(0, 6)}...{account.slice(-4)})
                </button>
              )}
              <p className="text-xs text-slate-500 mt-1">This wallet will administer the programme and authorise certificate issuers.</p>
            </div>
            <button onClick={deployUniversity} disabled={isDeploying} className={`${btnClass} bg-blue-600 hover:bg-blue-700`}>
              {isDeploying ? 'Registering Programme... Please wait' : 'Register Programme'}
            </button>
            {deployedUnivAddress && (
              <div className="mt-2 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Programme successfully registered. Contract address (save this):</p>
                <p className="font-mono text-green-400 text-sm break-all">{deployedUnivAddress}</p>
                <p className="text-xs text-slate-500 mt-2">This address uniquely identifies your programme on the blockchain. Complete Step 2 below to configure your signatories.</p>
                <button onClick={() => setConfigUnivAddress(deployedUnivAddress)} className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline">
                  Use this address for signatory setup
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Signature Configuration */}
          <div className="bg-slate-800 rounded-xl p-6 border border-blue-900/40 space-y-6 mt-6">
            <div className="flex items-center gap-2">
              <span className="bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 2</span>
              <h2 className="text-base font-bold">Configure Institution Signatories & Faculties</h2>
              <span className="text-xs text-slate-400 ml-auto">Draw real signatures using your mouse</span>
            </div>
            <p className="text-slate-400 text-sm">
              Add institution-wide signatories (Registrar, Vice-Chancellor), then configure faculties. Each faculty can represent a degree level (BSc, LLB, etc.) with its own dean. Signatures will appear on all issued certificates.
            </p>

            {/* Programme Address */}
            <div>
              <label className={labelClass}>Programme Contract Address</label>
              <input
                className={inputClass}
                placeholder="0x... (the address from Step 1)"
                value={configUnivAddress}
                onChange={(e) => setConfigUnivAddress(e.target.value)}
              />
            </div>

            {/* CORE SIGNATORIES SECTION */}
            <div className="border border-slate-700 rounded-lg p-4 space-y-6">
              <h3 className="text-sm font-semibold text-blue-300">Core Signatories (Required)</h3>

              {/* Registrar Signature */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Registrar&apos;s Name</label>
                    <input className={inputClass} placeholder="e.g. Dr. Ngozi Eze" value={registrarName} onChange={(e) => setRegistrarName(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Position</label>
                    <input className={inputClass} placeholder="e.g. Registrar" value={registrarPosition} onChange={(e) => setRegistrarPosition(e.target.value)} />
                  </div>
                </div>
                <label className="text-xs text-slate-300 font-semibold block mt-3">Draw Registrar&apos;s Signature</label>
                <div className="border border-slate-600 rounded-lg bg-slate-900 p-2">
                  <SignatureCanvas
                    ref={registrarSignatureRef}
                    penColor="white"
                    canvasProps={{ width: 500, height: 150, className: 'w-full cursor-crosshair' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => registrarSignatureRef.current?.clear()}
                    className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    Clear
                  </button>
                  <button
                    onClick={saveRegistrarSignature}
                    disabled={isUploadingSignature}
                    className={`text-xs px-3 py-1 ${registrarSignatureURL ? 'bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded`}
                  >
                    {registrarSignatureURL ? '✓ Saved' : isUploadingSignature ? 'Uploading...' : 'Save Signature'}
                  </button>
                </div>
              </div>

              {/* Vice-Chancellor Signature */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Vice-Chancellor&apos;s Name</label>
                    <input className={inputClass} placeholder="e.g. Prof. Samuel Ajayi" value={vcName} onChange={(e) => setVcName(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Position</label>
                    <input className={inputClass} placeholder="e.g. Vice-Chancellor" value={vcPosition} onChange={(e) => setVcPosition(e.target.value)} />
                  </div>
                </div>
                <label className="text-xs text-slate-300 font-semibold block mt-3">Draw Vice-Chancellor&apos;s Signature</label>
                <div className="border border-slate-600 rounded-lg bg-slate-900 p-2">
                  <SignatureCanvas
                    ref={vcSignatureRef}
                    penColor="white"
                    canvasProps={{ width: 500, height: 150, className: 'w-full cursor-crosshair' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => vcSignatureRef.current?.clear()}
                    className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    Clear
                  </button>
                  <button
                    onClick={saveVCSignature}
                    disabled={isUploadingSignature}
                    className={`text-xs px-3 py-1 ${vcSignatureURL ? 'bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded`}
                  >
                    {vcSignatureURL ? '✓ Saved' : isUploadingSignature ? 'Uploading...' : 'Save Signature'}
                  </button>
                </div>
              </div>

              {/* Dean Signature */}
              <div className="border border-slate-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Dean&apos;s Name</label>
                    <input className={inputClass} placeholder="e.g. Prof. Adebayo Ojo" value={deanName} onChange={(e) => setDeanName(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Dean&apos;s Position</label>
                    <input className={inputClass} placeholder="e.g. Dean of Faculty" value={deanPosition} onChange={(e) => setDeanPosition(e.target.value)} />
                  </div>
                </div>
                <label className="text-xs text-slate-300 font-semibold block mt-3">Draw Dean&apos;s Signature</label>
                <div className="bg-white rounded-lg mt-1 overflow-hidden border border-slate-600">
                  <SignatureCanvas
                    ref={deanSignatureRef}
                    penColor="black"
                    canvasProps={{ width: 500, height: 150, className: 'w-full cursor-crosshair' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deanSignatureRef.current?.clear()}
                    className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    Clear
                  </button>
                  <button
                    onClick={saveDeanSignature}
                    disabled={isUploadingSignature}
                    className={`text-xs px-3 py-1 ${deanSignatureURL ? 'bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded`}
                  >
                    {deanSignatureURL ? '✓ Saved' : isUploadingSignature ? 'Uploading...' : 'Save Signature'}
                  </button>
                </div>
              </div>

              {/* Verification Domain & Logo */}
              <div>
                <label className={labelClass}>Verification Domain (optional)</label>
                <input className={inputClass} placeholder="e.g. verify.oauife.edu.ng" value={verificationDomain} onChange={(e) => setVerificationDomain(e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">The domain printed on certificates for QR verification. Defaults to your platform URL.</p>
              </div>

              <div>
                <label className={labelClass}>Institution Logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className={inputClass}
                />
                <p className="text-xs text-slate-500 mt-1">Upload a logo (PNG, JPG, SVG — max 2MB). Will appear on certificates. Leave blank to use default PAX branding.</p>
                {logoFile && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-green-400">✓ {logoFile.name} selected</span>
                    <button onClick={() => setLogoFile(null)} className="text-xs text-slate-400 hover:text-slate-300 underline">Clear</button>
                  </div>
                )}
                {logoURL && <div className="mt-2 flex items-center gap-2"><span className="text-sm text-green-400">✓ Logo uploaded</span></div>}
              </div>

              {/* Save Core Signatories Button */}
              <button onClick={saveInstitutionConfig} disabled={isSettingConfig || logoUploading} className={`${btnClass} bg-blue-600 hover:bg-blue-700 w-full`}>
                {logoUploading ? 'Uploading logo...' : isSettingConfig ? 'Saving... Please wait' : 'Save Core Signatories to Blockchain'}
              </button>
            </div>

            {/* FACULTIES SECTION */}
            <div className="border border-slate-700 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-green-300">Configure Faculties & Degree Programs</h3>
              <p className="text-xs text-slate-400">Each faculty can represent a different degree level (e.g., &quot;Faculty of Science&quot; for BSc, &quot;Faculty of Law&quot; for LLB). Add a dean with signature for each faculty. You can add as many as your institution needs.</p>

              <div>
                <label className={labelClass}>Faculty / Degree Program Name</label>
                <input className={inputClass} placeholder="e.g. Faculty of Science (BSc) or Faculty of Law (LLB)" value={newFacultyName} onChange={(e) => setNewFacultyName(e.target.value)} />
              </div>

              <div>
                <label className={labelClass}>Dean&apos;s Name</label>
                <input className={inputClass} placeholder="e.g. Prof. Adewale Olumide" value={newFacultyDean} onChange={(e) => setNewFacultyDean(e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block">Draw Dean&apos;s Signature</label>
                <div className="border border-slate-600 rounded-lg bg-slate-900 p-2 mt-1">
                  <SignatureCanvas
                    ref={currentFacultySignatureRef}
                    penColor="white"
                    canvasProps={{ width: 500, height: 150, className: 'w-full cursor-crosshair' }}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => currentFacultySignatureRef.current?.clear()}
                    className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                  >
                    Clear
                  </button>
                  <button
                    onClick={addFacultySignatory}
                    disabled={isSavingFaculty}
                    className={`${btnClass} bg-green-600 hover:bg-green-700 text-sm`}
                  >
                    {isSavingFaculty ? 'Adding Faculty...' : '+ Add Faculty'}
                  </button>
                </div>
              </div>

              {/* Faculties List */}
              {configuredFaculties.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-400">Added Faculties ({configuredFaculties.length}):</p>
                  {configuredFaculties.map((fac) => (
                    <div key={fac.id} className="flex items-center justify-between bg-slate-700/30 p-2 rounded text-sm">
                      <div>
                        <p className="text-slate-300 font-semibold">{fac.name}</p>
                        <p className="text-xs text-slate-400">Dean: {fac.deanName}</p>
                      </div>
                      <span className="text-green-400 text-xs">✓ Signature saved</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Manage Institutions — Owner only */}
          <div className="bg-slate-800 rounded-xl p-6 border border-red-900/40 space-y-5 mt-6">
            <div className="flex items-center gap-2">
              <span className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 3</span>
              <h2 className="text-base font-bold">Manage Registered Institutions</h2>
              <span className="text-xs text-slate-400 ml-auto">Owner access only</span>
            </div>
            <p className="text-slate-400 text-sm">
              Deactivate an institution to remove them from the platform. Their existing certificates remain permanently verifiable on-chain, but no new certificates can be issued. You can reactivate them at any time.
            </p>

            {/* Deactivate form */}
            <div className="space-y-3 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-400">Deactivate an Institution</h3>
              <div>
                <label className={labelClass}>Institution Contract Address</label>
                <input
                  className={inputClass}
                  placeholder="0x..."
                  value={deactivateAddress}
                  onChange={(e) => setDeactivateAddress(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Reason for Deactivation</label>
                <select
                  className={inputClass}
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                >
                  <option value="">-- Select a reason --</option>
                  <option value="Non-compliance with Pax platform terms">Non-compliance with platform terms</option>
                  <option value="Institution requested removal from platform">Institution requested removal</option>
                  <option value="Fraudulent certificate activity detected">Fraudulent activity detected</option>
                  <option value="Licence or subscription expired">Licence / subscription expired</option>
                  <option value="Accreditation or regulatory issue">Accreditation or regulatory issue</option>
                  <option value="Institution permanently closed">Institution permanently closed</option>
                </select>
              </div>
              {deactivateReason && deactivateAddress && (
                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                  <p className="text-xs text-red-300">
                    This will permanently record on the blockchain: <span className="font-semibold">&quot;{deactivateReason}&quot;</span>. Existing certificates remain verifiable.
                  </p>
                </div>
              )}
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating || !deactivateAddress || !deactivateReason}
                className={`${btnClass} bg-red-700 hover:bg-red-600 disabled:opacity-50`}
              >
                {isDeactivating ? 'Deactivating... Please wait' : 'Deactivate Institution'}
              </button>
            </div>

            {/* Current institutions list with status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">All Registered Institutions</h3>
                <button
                  onClick={() => loadUniversities(true, 'owner')}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Refresh
                </button>
              </div>
              {isLoadingUnis ? (
                <p className="text-xs text-slate-500">Loading institutions...</p>
              ) : universities.length === 0 ? (
                <p className="text-xs text-slate-500">No institutions registered yet.</p>
              ) : (
                <div className="space-y-2">
                  {universities.map((u) => (
                    <div
                      key={u.address}
                      className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                        u.deactivated
                          ? 'bg-red-950/20 border-red-900/50'
                          : 'bg-slate-700/40 border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className={`font-medium truncate ${u.deactivated ? 'text-red-400 line-through opacity-60' : 'text-slate-200'}`}>
                          {u.name}
                        </span>
                        <span className="font-mono text-xs text-slate-500 truncate">{u.address}</span>
                        {u.deactivated && u.deactivationReason && (
                          <span className="text-xs text-red-400 mt-0.5">Reason: {u.deactivationReason}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          u.deactivated
                            ? 'bg-red-900/30 border-red-700 text-red-400'
                            : 'bg-green-900/30 border-green-700 text-green-400'
                        }`}>
                          {u.deactivated ? 'Deactivated' : 'Active'}
                        </span>
                        {u.deactivated && (
                          <button
                            onClick={() => handleReactivate(u.address)}
                            disabled={isReactivating === u.address}
                            className="text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-50"
                          >
                            {isReactivating === u.address ? 'Reactivating...' : 'Reactivate'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Issue Certificate Tab */}
        {activeTab === 'issue' && account && (walletRole === 'owner' || walletRole === 'admin' || walletRole === 'issuer') && (
          <div className="space-y-6">
            {/* Step 1: Grant Role */}
            <div className="bg-slate-800 rounded-xl p-6 border border-amber-700/40 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 1</span>
                <h2 className="text-base font-bold">Authorise a Certificate Issuer</h2>
                <span className="text-xs text-slate-400 ml-auto">One-time setup per programme</span>
              </div>
              <p className="text-slate-400 text-sm">The programme administrator must authorise a staff member before they can issue certificates. This only needs to be done once per issuer.</p>
              <div>
                <label className={labelClass}>Select University Programme</label>
                {!account ? (
                  <div className={`${inputClass} text-amber-400`}>Please connect your wallet to view your assigned programmes.</div>
                ) : isLoadingMyUnis ? (
                  <div className={`${inputClass} text-slate-400`}>Loading your programmes...</div>
                ) : myUniversities.length === 0 ? (
                  <div className="space-y-1">
                    <div className={`${inputClass} text-slate-500`}>No programmes are currently assigned to your wallet.</div>
                    <p className="text-xs text-slate-500">Your wallet must be registered as an administrator or authorised issuer on a programme to appear here.</p>
                    <button onClick={() => loadMyUniversities(account)} className="text-xs text-blue-400 hover:text-blue-300 underline">Refresh</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      className={inputClass}
                      value={univAddress}
                      onChange={(e) => { setUnivAddress(e.target.value); setHasIssuerRole(null); }}
                    >
                      <option value="">-- Select a programme --</option>
                      {myUniversities.map((u) => (
                        <option key={u.address} value={u.address}>{u.name}</option>
                      ))}
                    </select>
                    <button onClick={() => loadMyUniversities(account)} className="shrink-0 px-3 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300" title="Refresh">Reload</button>
                  </div>
                )}
                {hasIssuerRole === true && (
                  <p className="text-xs text-green-400 mt-1">This wallet is already authorised to issue certificates for this programme. You may proceed to Step 2.</p>
                )}
                {hasIssuerRole === false && (
                  <p className="text-xs text-amber-400 mt-1">This wallet is not yet authorised. Please complete Step 1 before issuing certificates.</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Staff Wallet Address</label>
                <input className={inputClass} placeholder="0x... (wallet address of the staff member to authorise)" value={grantAddress} onChange={(e) => setGrantAddress(e.target.value)} />
                {account && (
                  <button onClick={() => setGrantAddress(account)} className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline">
                    Use my connected wallet ({account.slice(0, 6)}...{account.slice(-4)})
                  </button>
                )}
              </div>
              <button onClick={grantIssuerRole} disabled={isGranting || hasIssuerRole === true} className={`${btnClass} bg-amber-600 hover:bg-amber-700 disabled:opacity-50`}>
                {isGranting ? 'Authorising... Please wait' : hasIssuerRole === true ? 'Already Authorised' : 'Authorise Issuer'}
              </button>
            </div>

            {/* Step 2: Issue Certificate */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 2</span>
                <h2 className="text-base font-bold">Issue Certificate</h2>
              </div>
              <p className="text-slate-400 text-sm">Issue a tamper-proof, permanent certificate to a student. The certificate is tied to their wallet and cannot be transferred.</p>
              <div>
                <label className={labelClass}>Select Programme</label>
                {myUniversities.length === 0 ? (
                  <div className={`${inputClass} text-slate-400`}>Please complete Step 1 first to load your assigned programmes.</div>
                ) : (
                  <select
                    className={inputClass}
                    value={univAddress}
                    onChange={(e) => setUnivAddress(e.target.value)}
                  >
                    <option value="">-- Select a programme --</option>
                    {myUniversities.map((u) => (
                      <option key={u.address} value={u.address}>{u.name}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-slate-500 mt-1">Select the programme this certificate is being issued under.</p>
              </div>
              <div>
                <label className={labelClass}>Student Wallet Address</label>
                <input className={inputClass} placeholder="0x... (student's wallet address)" value={studentAddress} onChange={(e) => setStudentAddress(e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">The certificate will be permanently issued to this wallet address.</p>
              </div>
              <div>
                <label className={labelClass}>Student Full Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. James Jonah"
                  value={certificateName}
                  onChange={(e) => setCertificateName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div>
                <label className={labelClass}>Select Faculty <span className="text-slate-500 font-normal">(for dean signature)</span></label>
                <select 
                  className={inputClass}
                  value={selectedFaculty} 
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  disabled={!univAddress || faculties.length === 0 || isLoadingFaculties}
                >
                  <option value="">
                    {isLoadingFaculties ? '⏳ Loading faculties...' : faculties.length === 0 ? 'Select a programme first' : '-- Select Faculty --'}
                  </option>
                  {faculties.map((fac) => (
                    <option key={fac.facultyName} value={fac.facultyName}>
                      {fac.facultyName} (Dean: {fac.deanName})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Select the faculty the student belongs to. The dean's signature for this faculty will appear on the certificate.</p>
              </div>
              <div>
                <label className={labelClass}>Field of Study</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Engineering Physics"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div>
                <label className={labelClass}>Classification / Grade</label>
                <select className={inputClass} value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="">-- Select classification --</option>
                  <option value="First Class Honours">First Class Honours</option>
                  <option value="Second Class Honours (Upper Division)">Second Class Honours (Upper Division)</option>
                  <option value="Second Class Honours (Lower Division)">Second Class Honours (Lower Division)</option>
                  <option value="Third Class Honours">Third Class Honours</option>
                  <option value="Pass">Pass</option>
                  <option value="Distinction">Distinction</option>
                  <option value="Merit">Merit</option>
                  <option value="Credit">Credit</option>
                  <option value="Satisfactory">Satisfactory</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">This will appear on the certificate NFT and is encrypted on-chain.</p>
              </div>
              <div>
                <label className={labelClass}>PaxID (Matric Number)</label>
                <input
                  className={inputClass}
                  placeholder="e.g. PHY/2019/054"
                  value={paxId}
                  onChange={(e) => setPaxId(e.target.value.toUpperCase())}
                  maxLength={50}
                />
                <p className="text-xs text-slate-500 mt-1">Stored in uppercase automatically. Employers can type it in any case to verify. Must be unique per student.</p>
              </div>
              <div>
                <label className={labelClass}>Student Email <span className="text-slate-500 font-normal">(optional — for softcopy delivery)</span></label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="e.g. jane.doe@university.edu"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  maxLength={254}
                />
                <p className="text-xs text-slate-500 mt-1">If provided, the student receives a beautiful PDF-quality certificate to their inbox immediately after issuance. The email is never stored — it is used once and discarded.</p>
              </div>
              <button onClick={issueCertificate} disabled={isIssuing} className={`${btnClass} bg-green-600 hover:bg-green-700`}>
                {isIssuing ? 'Issuing Certificate... Please wait' : 'Issue Certificate'}
              </button>
            </div>

            {/* Step 3: Revoke Certificate */}
            <div className="bg-slate-800 rounded-xl p-6 border border-red-900/40 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-red-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 3</span>
                <h2 className="text-base font-bold">Revoke a Certificate</h2>
                <span className="text-xs text-slate-400 ml-auto">Admin only</span>
              </div>
              <p className="text-slate-400 text-sm">
                Revoke an issued certificate. The revocation and its reason are recorded permanently on the blockchain and will be visible to anyone who verifies that certificate.
              </p>
              <div>
                <label className={labelClass}>Select Programme</label>
                {myUniversities.length === 0 ? (
                  <div className={`${inputClass} text-slate-400`}>No programmes assigned to your wallet yet.</div>
                ) : (
                  <select
                    className={inputClass}
                    value={univAddress}
                    onChange={(e) => setUnivAddress(e.target.value)}
                  >
                    <option value="">-- Select a programme --</option>
                    {myUniversities.map((u) => (
                      <option key={u.address} value={u.address}>{u.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className={labelClass}>Student Wallet Address</label>
                <input
                  className={inputClass}
                  placeholder="0x... (wallet address of the student)"
                  value={revokeAddress}
                  onChange={(e) => setRevokeAddress(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Reason for Revocation</label>
                <select
                  className={inputClass}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                >
                  <option value="">-- Select a reason --</option>
                  {REVOCATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>{preset}</option>
                  ))}
                  <option value="custom">Other ��� enter custom reason</option>
                </select>
              </div>
              {revokeReason === 'custom' && (
                <div>
                  <label className={labelClass}>Custom Reason</label>
                  <input
                    className={inputClass}
                    placeholder="Describe the reason for revocation..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    maxLength={200}
                  />
                </div>
              )}
              {revokeReason && revokeReason !== 'custom' && (
                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                  <p className="text-xs text-red-300">
                    This will be recorded on the blockchain as: <span className="font-semibold">&quot;{revokeReason}&quot;</span>
                  </p>
                </div>
              )}
              {revokeReason === 'custom' && customReason && (
                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                  <p className="text-xs text-red-300">
                    This will be recorded on the blockchain as: <span className="font-semibold">&quot;{customReason}&quot;</span>
                  </p>
                </div>
              )}
              <div>
                <label className={labelClass}>Student Email <span className="text-slate-500 font-normal">(optional — to notify them)</span></label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="e.g. student@university.edu"
                  value={revokeEmail}
                  onChange={(e) => setRevokeEmail(e.target.value)}
                  maxLength={254}
                />
                <p className="text-xs text-slate-500 mt-1">If provided, the student will receive an email notifying them of the revocation and the reason. The email is not stored.</p>
              </div>
              <button
                onClick={handleRevoke}
                disabled={isRevoking || !revokeAddress || !revokeReason}
                className={`${btnClass} bg-red-700 hover:bg-red-600 disabled:opacity-50`}
              >
                {isRevoking ? 'Revoking... Please wait' : 'Revoke Certificate'}
              </button>
            </div>
          </div>
        )}

        {/* Verify Certificate Tab */}
        {activeTab === 'verify' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
            <div>
              <h2 className="text-lg font-bold">Verify a Certificate</h2>
              <p className="text-slate-400 text-sm mt-1">Confirm the authenticity of any certificate issued through this platform. Open to the public — no account or wallet needed.</p>
            </div>

            <div>
              <label className={labelClass}>Select Institution & Programme</label>
              {isLoadingUnis ? (
                <div className="w-full px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 text-slate-400 text-sm">
                  Loading registered programmes...
                </div>
              ) : universities.length === 0 ? (
                <div className="flex gap-2 items-center">
                  <select className={inputClass} disabled>
                    <option>No programmes registered yet</option>
                  </select>
                  <button onClick={loadUniversities} className="shrink-0 px-3 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300">
                    Reload
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <select
                    className={inputClass}
                    value={verifyUniv}
                    onChange={(e) => { setVerifyUniv(e.target.value); setCertResult(null); }}
                  >
                    <option value="">-- Select an institution and programme --</option>
                    {universities.map((u) => (
                      <option key={u.address} value={u.address}>{u.name}</option>
                    ))}
                  </select>
                  <button onClick={loadUniversities} className="shrink-0 px-3 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300" title="Refresh list">
                    Reload
                  </button>
                </div>
              )}
            </div>

            {/* Toggle: wallet address vs PaxID */}
            <div className="flex gap-2 bg-slate-700/60 p-1 rounded-lg">
              <button
                onClick={() => { setVerifyMode('paxid'); setCertResult(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${verifyMode === 'paxid' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Search by PaxID / Matric No.
              </button>
              <button
                onClick={() => { setVerifyMode('wallet'); setCertResult(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${verifyMode === 'wallet' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Search by Wallet Address
              </button>
            </div>

            {verifyMode === 'paxid' ? (
              <div>
                <label className={labelClass}>PaxID / Matric Number</label>
                <input
                  className={inputClass}
                  placeholder="e.g. PHY/2019/054"
                  value={verifyPaxId}
                  onChange={(e) => { setVerifyPaxId(e.target.value); setCertResult(null); }}
                />
                <p className="text-xs text-slate-500 mt-1">Enter the student&apos;s matric number exactly as registered. No wallet address needed.</p>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Graduate Wallet Address</label>
                <input
                  className={inputClass}
                  placeholder="0x... (the graduate's wallet address)"
                  value={verifyStudent}
                  onChange={(e) => { setVerifyStudent(e.target.value); setCertResult(null); }}
                />
              </div>
            )}

            <button onClick={verifyCertificate} disabled={isVerifying} className={`${btnClass} bg-purple-600 hover:bg-purple-700`}>
              {isVerifying ? 'Verifying...' : 'Verify Certificate'}
            </button>

            {certResult && (
              <div className={`mt-2 p-5 rounded-xl border space-y-4 ${certResult.isRevoked ? 'bg-red-900/20 border-red-700/60' : 'bg-slate-700/60 border-green-700/50'}`}>
                {/* Status banner */}
                {certResult.isRevoked ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0"></div>
                      <span className="text-red-400 font-semibold text-sm">Certificate Revoked</span>
                    </div>
                    <div className="p-3 bg-red-900/30 border border-red-700/40 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Reason for Revocation</p>
                      <p className="text-red-200 text-sm font-medium">This certificate was revoked by the issuing institution because: {certResult.revocationReason}</p>
                      {certResult.revocationDate && (
                        <p className="text-xs text-slate-500 mt-1">Revoked on {certResult.revocationDate}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0 animate-pulse"></div>
                    <span className="text-green-400 font-semibold text-sm">Certificate Verified — Authentic and Tamper-Proof</span>
                  </div>
                )}
                {/* Certificate details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Graduate Name</p>
                    <p className={`font-medium ${certResult.isRevoked ? 'text-slate-400 line-through' : 'text-white'}`}>{certResult.candidateName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">PaxID / Matric No.</p>
                    <p className="font-mono text-white font-semibold">{certResult.paxId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Field of Study</p>
                    <p className={`font-medium ${certResult.isRevoked ? 'text-slate-400 line-through' : 'text-white'}`}>{certResult.courseName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Classification</p>
                    <p className={`font-medium ${certResult.isRevoked ? 'text-slate-400 line-through' : 'text-white'}`}>{certResult.grade || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Institution & Programme</p>
                    <p className="text-white font-medium">{certResult.universityName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Date of Issue</p>
                    <p className="text-white font-medium">{certResult.issuedAt}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-600 flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Certificate Reference</p>
                    <p className="font-mono text-white font-semibold text-sm">#{certResult.tokenId}</p>
                    <p className="text-slate-500 text-xs mt-0.5">Unique credential identifier on the blockchain</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <a
                      href={`https://sepolia.etherscan.io/token/${certResult.univAddress}?a=${certResult.studentAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      View on Blockchain
                    </a>
                    <a
                      href={`/api/certificate/image?name=${encodeURIComponent(certResult.candidateName)}&course=${encodeURIComponent(certResult.courseName)}&grade=${encodeURIComponent(certResult.grade)}&paxId=${encodeURIComponent(certResult.paxId)}&university=${encodeURIComponent(certResult.universityName)}&date=${encodeURIComponent(certResult.issuedAt)}&registrar=${encodeURIComponent(certResult.registrar || '')}&registrarSig=${encodeURIComponent(certResult.registrarSignature || '')}&registrarPos=${encodeURIComponent(certResult.registrarPosition || 'Registrar')}&vc=${encodeURIComponent(certResult.vc || '')}&vcSig=${encodeURIComponent(certResult.vcSignature || '')}&vcPos=${encodeURIComponent(certResult.vcPosition || 'Vice-Chancellor')}&dean=${encodeURIComponent(certResult.dean || '')}&deanSig=${encodeURIComponent(certResult.deanSignature || '')}&deanPos=${encodeURIComponent(certResult.deanPosition || 'Dean')}&logo=${encodeURIComponent(certResult.logoUrl || '')}&domain=${encodeURIComponent(certResult.domain || 'v0-paxadmin.vercel.app')}&verifyUrl=${encodeURIComponent(`https://${certResult.domain}/?tab=verify&paxId=${certResult.paxId}&contract=${certResult.univAddress}`)}&revoked=${certResult.isRevoked ? 'true' : 'false'}&revokeReason=${encodeURIComponent(certResult.revocationReason || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-400 hover:text-green-300 underline"
                    >
                      View Certificate
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-slate-600 space-y-1">
          <p>Powered by Pax &mdash; Blockchain-Verified Academic Credentials</p>
          <p className="text-slate-700">
            Running on Sepolia Testnet &mdash; Registry:{' '}
            <a
              href={`https://sepolia.etherscan.io/address/${FACTORY_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-slate-500 underline"
              title="View factory contract on Etherscan"
            >
              {FACTORY_ADDRESS.slice(0, 6)}...{FACTORY_ADDRESS.slice(-4)}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
