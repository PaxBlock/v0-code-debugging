// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Factory contract - Faculty-based signatories, auto-issuer grant, deactivation support
// DEPLOYED WITH PAX OWNER WALLET — automatically grants owner DEFAULT_ADMIN_ROLE
const FACTORY_ADDRESS = '0xa342F135743925e03462880d171d106adF900B57';
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX = '0xaa36a7';

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
];

const UNIVERSITY_ABI = [
  'function name() external view returns (string)',
  'function issueCertificate(address student, string memory _candidateName, string memory _courseName, string memory _grade, string memory _paxId, uint256 _facultyIndex) external returns (uint256)',
  'function hasCertificate(address student) external view returns (bool)',
  'function certificates(uint256 tokenId) external view returns (string candidateName, string courseName, string grade, string paxId, uint256 issuanceDate, address issuer, uint256 facultyIndex)',
  'function studentToTokenId(address student) external view returns (uint256)',
  'function grantRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ISSUER_ROLE() external view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
  'function revokeCertificate(address student, string memory reason) external',
  'function getFaculties() external view returns (tuple(string name, string deanName, string deanSignatureURL)[])',
  'function getFaculty(uint256 index) external view returns (tuple(string name, string deanName, string deanSignatureURL))',
  'function getFacultyCount() external view returns (uint256)',
  'function getDeanSignatureURL(uint256 facultyIndex) external view returns (string)',
  'function getRegistrarSignatureURL() external view returns (string)',
  'function getVCSignatureURL() external view returns (string)',
  'function setInstitutionConfig(tuple(string name, string deanName, string deanSignatureURL)[] faculties, string registrarName, string registrarSignatureURL, string viceChancellorName, string vceSignatureURL, string verificationDomain, string logoURL) external',
  'function isRevoked(address student) external view returns (bool)',
  'function revocationReason(address student) external view returns (string)',
  'function revocationDate(address student) external view returns (uint256)',
  'function resolvePaxId(string memory paxId) external view returns (address)',
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
    return 'Access denied: Your wallet does not have admin permission on the Factory contract. If you are the Pax platform owner, contact the person who deployed the Factory to grant your wallet address DEFAULT_ADMIN_ROLE. Your wallet: 0x81cfbda75f9fbdb84364ae887409e56636389ad2. Factory: 0xa342F135743925e03462880d171d106adF900B57';
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
  const [degreeLevel, setDegreeLevel] = useState('');
  const [univSymbol, setUnivSymbol] = useState('');
  const [univAdmin, setUnivAdmin] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUnivAddress, setDeployedUnivAddress] = useState('');

  // Issue tab
  const [univAddress, setUnivAddress] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [grade, setGrade] = useState('');
  const [paxId, setPaxId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [grantAddress, setGrantAddress] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [adminHasIssuerRole, setAdminHasIssuerRole] = useState<boolean | null>(null);
  const [targetHasIssuerRole, setTargetHasIssuerRole] = useState<boolean | null>(null);

  // Institution config (Register tab - step 2)
  const [configUnivAddress, setConfigUnivAddress] = useState('');
  const [deanName, setDeanName] = useState('');
  const [registrarName, setRegistrarName] = useState('');
  const [vcName, setVcName] = useState('');
  const [verificationDomain, setVerificationDomain] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoURL, setLogoURL] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [isSettingConfig, setIsSettingConfig] = useState(false);

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
  const [faculties, setFaculties] = useState<Array<{ name: string; deanName: string; deanSignatureURL: string }>>([]);
  const [selectedFacultyIndex, setSelectedFacultyIndex] = useState<number | ''>('');
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
    registrar: string;
    vc: string;
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
          let config = { deanName: '', registrarName: '', viceChancellorName: '', verificationDomain: '', logoURL: '' };
          try { config = await university.institutionConfig(); } catch (_e) { /* silent */ }
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
            dean: config.deanName || '',
            registrar: config.registrarName || '',
            vc: config.viceChancellorName || '',
            logoUrl: config.logoURL || '',
            domain: config.verificationDomain || 'v0-paxadmin.vercel.app',
          });
          showMsg(revoked ? 'error' : 'success', revoked ? 'This certificate has been revoked.' : 'Certificate verified on the blockchain!');
        } catch (_e) { /* silent — user can manually hit Verify if auto fails */ }
        finally { setIsVerifying(false); }
      }, 800);
    }
  }, []);

  // Load all universities when verify tab opens (public)
  // Load only wallet's universities when issue tab opens (role-filtered)
  useEffect(() => {
    if (activeTab === 'verify') {
      loadUniversities();
    }
    if (activeTab === 'issue' && account) {
      loadMyUniversities(account);
    }
  }, [activeTab, account]);

  // Check if admin has issuer role when univAddress changes
  useEffect(() => {
    if (!account || !univAddress || !ethers.isAddress(univAddress)) {
      setAdminHasIssuerRole(null);
      return;
    }
    checkAdminIssuerRole();
  }, [account, univAddress]);

  // Check if TARGET address has issuer role when grantAddress changes
  useEffect(() => {
    if (!univAddress || !grantAddress || !ethers.isAddress(grantAddress)) {
      setTargetHasIssuerRole(null);
      return;
    }
    checkTargetIssuerRole();
  }, [univAddress, grantAddress]);

  const checkAdminIssuerRole = async () => {
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, provider);
      const issuerRole = await university.ISSUER_ROLE();
      const hasRole = await university.hasRole(issuerRole, account);
      setAdminHasIssuerRole(hasRole);
    } catch (_e) {
      setAdminHasIssuerRole(null);
    }
  };

  const checkTargetIssuerRole = async () => {
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, provider);
      const issuerRole = await university.ISSUER_ROLE();
      const hasRole = await university.hasRole(issuerRole, grantAddress);
      setTargetHasIssuerRole(hasRole);
    } catch (_e) {
      setTargetHasIssuerRole(null);
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
          console.log('[v0] Could not load universities from factory:', FACTORY_ADDRESS);
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
      // Reset selected faculty when universities change
      setSelectedFacultyIndex('');
      setFaculties([]);
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Could not load universities. Please try again.');
    } finally {
      setIsLoadingMyUnis(false);
    }
  };

  // Load faculties when user selects a university in the Issue form
  const loadFacultiesForUniversity = async (univAddr: string) => {
    if (!univAddr || !ethers.isAddress(univAddr)) {
      setFaculties([]);
      setSelectedFacultyIndex('');
      return;
    }
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(univAddr, UNIVERSITY_ABI, provider);
      const facultyList = await university.getFaculties();
      setFaculties(facultyList);
      // Auto-select first faculty if available
      if (facultyList.length > 0) {
        setSelectedFacultyIndex(0);
      } else {
        showMsg('error', 'This programme has no faculties configured. Contact the administrator.');
      }
    } catch (_e) {
      setFaculties([]);
      setSelectedFacultyIndex('');
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
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univName || !degreeLevel || !univSymbol || !univAdmin) { showMsg('error', 'Please fill in all fields before deploying.'); return; }
    if (!ethers.isAddress(univAdmin)) { showMsg('error', 'The admin wallet address is not valid. Please check and try again.'); return; }
    setIsDeploying(true);
    try {
      // Combine university name and degree level into one clear contract name
      const fullName = `${univName.trim()} - ${degreeLevel}`;
      const baseMetadataURI = window.location.origin;
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      showMsg('info', 'Deploying university contract... Please confirm in MetaMask.');
      const tx = await factory.deployUniversity(fullName, univSymbol, univAdmin, baseMetadataURI);
      const receipt = await tx.wait();
      const event = receipt.logs.find((l: { topics: string[] }) => l.topics.length > 0);
      const univAddr = event?.address || receipt.contractAddress || 'Check Etherscan';
      setDeployedUnivAddress(univAddr);
      showMsg('success', `University deployed successfully!`);
    } catch (error) {
      showMsg('error', parseError(error));
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

      // Re-check the target's issuer role to update UI
      await checkTargetIssuerRole();
      showMsg('success', `Issuer Role granted to ${grantAddress.slice(0, 6)}...${grantAddress.slice(-4)}. They can now issue certificates on this programme.`);
      // Refresh the wallet's university list in case the grantee is the current wallet
      await loadMyUniversities(account);
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsGranting(false);
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload-logo', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Logo upload failed');
    const { url } = await res.json();
    return url;
  };

  const saveInstitutionConfig = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (walletRole !== 'owner') { showMsg('error', 'Only the Pax platform owner can configure institution signatories.'); return; }
    if (!configUnivAddress || !ethers.isAddress(configUnivAddress)) { showMsg('error', 'Please enter a valid programme contract address.'); return; }
    if (!deanName || !registrarName || !vcName) { showMsg('error', 'Please fill in all signatory names.'); return; }
    setIsSettingConfig(true);
    let finalLogoURL = logoURL;
    try {
      // Upload logo if provided
      if (logoFile) {
        setLogoUploading(true);
        showMsg('info', 'Uploading institution logo...');
        finalLogoURL = await uploadLogo(logoFile);
        setLogoURL(finalLogoURL);
        setLogoUploading(false);
      }

      const university = new ethers.Contract(configUnivAddress, UNIVERSITY_ABI, signer);
      showMsg('info', 'Saving institution config... Please confirm in MetaMask.');
      // For now, use empty faculties array — faculty config will be added in next phase
      const faculties = [];
      const registrarSignatureURL = '';
      const vcSignatureURL = '';
      const tx = await university.setInstitutionConfig(faculties, registrarName, registrarSignatureURL, vcName, vcSignatureURL, verificationDomain, finalLogoURL);
      await tx.wait();
      showMsg('success', 'Institution configuration saved. Logo and signatories will appear on all certificates from this programme.');
      setDeanName(''); setRegistrarName(''); setVcName(''); setVerificationDomain(''); setLogoFile(null); setLogoURL('');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsSettingConfig(false);
      setLogoUploading(false);
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

  const issueCertificate = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univAddress || !studentAddress || !certificateName || !courseName || !grade || !paxId) {
      showMsg('error', 'Please fill in all fields including grade and PaxID before issuing a certificate.'); return;
    }
    if (selectedFacultyIndex === '') {
      showMsg('error', 'Please select a faculty for this certificate.'); return;
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
      const tx = await university.issueCertificate(studentAddress, encryptedName, encryptedCourse, encryptedGrade, normalisedPaxId, selectedFacultyIndex);
      const receipt = await tx.wait();

      showMsg('success', `Certificate issued to ${certificateName}! PaxID: ${normalisedPaxId}`);

      // Send email softcopy if email was provided — fire and forget, never store it
      if (studentEmail) {
        showMsg('info', 'Sending certificate to student email...');
        try {
          const univName = myUniversities.find(u => u.address.toLowerCase() === univAddress.toLowerCase())?.name || 'Your Institution';
          
          // Fetch institution config to get signatories and logo for email certificate
          let deanName = '', registrarName = '', vcName = '', logoUrl = '';
          try {
            const provider = await getReadOnlyProvider();
            const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, provider);
            
            // Get the dean for this specific faculty
            if (typeof selectedFacultyIndex === 'number' && selectedFacultyIndex < faculties.length) {
              deanName = faculties[selectedFacultyIndex].deanName || '';
            }
            
            // For now, fetch registrar and VC — these are global (will be stored in contract config)
            // TODO: Add getRegistrarName() and getVCName() to ABI once contract is updated
            registrarName = 'Registrar';
            vcName = 'Vice-Chancellor';
            logoUrl = ''; // TODO: Fetch logo URL from contract
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
              dean: deanName,
              registrar: registrarName,
              vc: vcName,
              logoUrl: logoUrl,
            }),
          });
          showMsg('success', `Certificate email sent to ${studentEmail}`);
        } catch (_e) {
          showMsg('error', 'Certificate issued successfully but email failed to send. The blockchain record is safe.');
        }
      }

      setStudentAddress('');
      setCertificateName('');
      setCourseName('');
      setGrade('');
      setPaxId('');
      setStudentEmail('');
    } catch (error) {
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
      let institutionConfig = { deanName: '', registrarName: '', viceChancellorName: '', verificationDomain: '', logoURL: '' };
      try {
        institutionConfig = await university.institutionConfig();
      } catch (_e) { /* Silent — institution config may not be set */ }

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
        dean: institutionConfig.deanName || '',
        registrar: institutionConfig.registrarName || '',
        vc: institutionConfig.viceChancellorName || '',
        logoUrl: institutionConfig.logoURL || '',
        domain: institutionConfig.verificationDomain || 'v0-paxadmin.vercel.app',
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
                : 'This section requires Pax platform owner permissions. If you are the Pax owner, your wallet (0x81cfbda75f9fbdb84364ae887409e56636389ad2) must be granted DEFAULT_ADMIN_ROLE on the Factory contract (0xa342F135743925e03462880d171d106adF900B57). Contact the deployer.'}
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
            </div>
            <div>
              <label className={labelClass}>Degree / Programme Level</label>
              <select
                className={inputClass}
                value={degreeLevel}
                onChange={(e) => setDegreeLevel(e.target.value)}
              >
                <option value="">-- Select programme level --</option>
                <option value="BSc">BSc - Bachelor of Science</option>
                <option value="BA">BA - Bachelor of Arts</option>
                <option value="BEng">BEng - Bachelor of Engineering</option>
                <option value="LLB">LLB - Bachelor of Law</option>
                <option value="MBBS">MBBS - Medicine and Surgery</option>
                <option value="MSc">MSc - Master of Science</option>
                <option value="MA">MA - Master of Arts</option>
                <option value="MBA">MBA - Master of Business Administration</option>
                <option value="LLM">LLM - Master of Law</option>
                <option value="PhD">PhD - Doctor of Philosophy</option>
                <option value="Diploma">Diploma</option>
                <option value="HND">HND - Higher National Diploma</option>
                <option value="Certificate">Certificate of Completion</option>
              </select>
              {univName && degreeLevel && (
                <p className="text-xs text-blue-400 mt-1">
                  Programme will be registered as: <span className="font-semibold">&quot;{univName} - {degreeLevel}&quot;</span>
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Certificate Identifier</label>
              <input className={inputClass} placeholder="e.g. UNILAG" value={univSymbol} onChange={(e) => setUnivSymbol(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">A short unique code for this programme (2-6 characters, e.g. UNILAG, HARV)</p>
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

          {/* Step 2: Signatory Configuration */}
          <div className="bg-slate-800 rounded-xl p-6 border border-blue-900/40 space-y-4 mt-6">
            <div className="flex items-center gap-2">
              <span className="bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 2</span>
              <h2 className="text-base font-bold">Configure Institution Signatories</h2>
              <span className="text-xs text-slate-400 ml-auto">Pax owner only</span>
            </div>
            <p className="text-slate-400 text-sm">
              Configure the Registrar, Vice-Chancellor, and faculty deans that will sign all certificates issued under this programme. You can update signatories anytime when personnel changes.
            </p>
            {walletRole !== 'owner' && (
              <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-xs text-red-300">
                  ⚠️ This section is restricted to the Pax platform owner. Your wallet does not have permission to configure signatories.
                </p>
              </div>
            )}
            {walletRole === 'owner' && (
              <>
                <div>
                  <label className={labelClass}>Programme Contract Address</label>
                  <input
                    className={inputClass}
                    placeholder="0x... (the address from Step 1)"
                    value={configUnivAddress}
                    onChange={(e) => setConfigUnivAddress(e.target.value)}
                  />
                </div>

                {/* Global Signatories */}
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <h3 className="text-sm font-bold mb-3">Global Signatories</h3>
                  <div>
                    <label className={labelClass}>Registrar Name</label>
                    <input className={inputClass} placeholder="e.g. Dr. Afolayan Olufemi" value={registrarName} onChange={(e) => setRegistrarName(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Vice-Chancellor Name</label>
                    <input className={inputClass} placeholder="e.g. Prof. Bamitale Omole" value={vcName} onChange={(e) => setVcName(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Institution Logo</label>
                    <input
                      className={inputClass}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
                      }}
                    />
                    {logoURL && (
                      <div className="mt-2">
                        <img src={logoURL} alt="Logo preview" className="h-12 w-12 object-contain" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Verification Domain (optional)</label>
                    <input className={inputClass} placeholder="e.g. verify.oauife.edu.ng" value={verificationDomain} onChange={(e) => setVerificationDomain(e.target.value)} />
                    <p className="text-xs text-slate-500 mt-1">Where students can verify their certificates. Leave blank to use the Pax platform.</p>
                  </div>
                </div>

                {/* Faculty Management */}
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold">Faculties & Deans</h3>
                    <button className="text-xs bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded">
                      Add Faculty
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Add each faculty with its dean. Each dean's signature will appear on certificates from their faculty.</p>
                  {/* Faculty list will go here — for now empty state */}
                  <div className="p-4 bg-slate-900/50 rounded border border-slate-700 text-center">
                    <p className="text-xs text-slate-500">No faculties configured yet. Add a faculty to get started.</p>
                  </div>
                </div>

                <button onClick={() => {
                  if (!configUnivAddress) { showMsg('error', 'Please enter a programme contract address.'); return; }
                  // TODO: Call saveInstitutionConfig with faculties array
                }} disabled={isSettingConfig} className={`${btnClass} bg-amber-600 hover:bg-amber-700`}>
                  {isSettingConfig ? 'Saving Configuration... Please wait' : 'Save Institution Configuration'}
                </button>
              </>
            )}
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
                    onChange={(e) => {
                      setUnivAddress(e.target.value);
                      loadFacultiesForUniversity(e.target.value);
                    }}
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

        {/* Issue Certificate Tab */}
        {activeTab === 'issue' && account && (walletRole === 'owner' || walletRole === 'admin' || walletRole === 'issuer') && (
          <div className="space-y-6">
            {/* Step 2: Issue Certificate */}
            <div className="bg-slate-800 rounded-xl p-6 border border-green-900/40 space-y-4">
              <div className="flex items-center gap-2">
                <span className="bg-green-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">Step 2</span>
                <h2 className="text-base font-bold">Issue Certificate</h2>
              </div>
              <p className="text-slate-400 text-sm">
                Issue a new blockchain-verified certificate to a student. All information is encrypted and stored securely.
              </p>

              <div>
                <label className={labelClass}>Select Programme</label>
                {myUniversities.length === 0 ? (
                  <div className={`${inputClass} text-slate-400`}>No programmes assigned to your wallet yet.</div>
                ) : (
                  <select
                    className={inputClass}
                    value={univAddress}
                    onChange={(e) => {
                      setUnivAddress(e.target.value);
                      loadFacultiesForUniversity(e.target.value);
                    }}
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
                <input className={inputClass} placeholder="0x... (student's wallet address)" value={studentAddress} onChange={(e) => setStudentAddress(e.target.value)} />
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
                    onChange={(e) => {
                      setUnivAddress(e.target.value);
                      loadFacultiesForUniversity(e.target.value);
                    }}
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
                  <option value="custom">Other — enter custom reason</option>
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
                      href={`/api/certificate/image?name=${encodeURIComponent(certResult.candidateName)}&course=${encodeURIComponent(certResult.courseName)}&grade=${encodeURIComponent(certResult.grade)}&paxId=${encodeURIComponent(certResult.paxId)}&university=${encodeURIComponent(certResult.universityName)}&date=${encodeURIComponent(certResult.issuedAt)}&dean=${encodeURIComponent(certResult.dean || '')}&registrar=${encodeURIComponent(certResult.registrar || '')}&vc=${encodeURIComponent(certResult.vc || '')}&logo=${encodeURIComponent(certResult.logoUrl || '')}&domain=${encodeURIComponent(certResult.domain || 'v0-paxadmin.vercel.app')}&verifyUrl=${encodeURIComponent(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://v0-paxadmin.vercel.app'}/?tab=verify&paxId=${certResult.paxId}&contract=${certResult.univAddress}`)}&revoked=${certResult.isRevoked ? 'true' : 'false'}&revokeReason=${encodeURIComponent(certResult.revocationReason || '')}`}
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
