// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// New Factory contract - includes revocation support in AcademicCertificate
const FACTORY_ADDRESS = '0x1dE61396792Ee6Cb3251D2EcD8A93a03B4Da8FF2';
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX = '0xaa36a7';

const FACTORY_ABI = [
  'function deployUniversity(string memory universityName, string memory symbol, address universityAdmin) external returns (address)',
  'function getUniversityCount() external view returns (uint256)',
  'function deployedUniversities(uint256 index) external view returns (address)',
  'function getWalletUniversities(address wallet) external view returns (address[])',
  'function registerIssuer(address universityContract, address wallet) external',
  'function isUniversityContract(address) external view returns (bool)',
];

const UNIVERSITY_ABI = [
  'function name() external view returns (string)',
  'function issueCertificate(address student, string memory _tokenURI, string memory _candidateName, string memory _courseName) external returns (uint256)',
  'function hasCertificate(address student) external view returns (bool)',
  'function certificates(uint256 tokenId) external view returns (string candidateName, string courseName, uint256 issuanceDate, address issuer)',
  'function studentToTokenId(address student) external view returns (uint256)',
  'function grantRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ISSUER_ROLE() external view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() external view returns (bytes32)',
  'function revokeCertificate(address student, string memory reason) external',
  'function isRevoked(address student) external view returns (bool)',
  'function revocationReason(address student) external view returns (string)',
  'function revocationDate(address student) external view returns (uint256)',
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
type University = { address: string; name: string };

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
  const [activeTab, setActiveTab] = useState<'deploy' | 'issue' | 'verify'>('deploy');
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
  const [isIssuing, setIsIssuing] = useState(false);
  const [grantAddress, setGrantAddress] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [hasIssuerRole, setHasIssuerRole] = useState<boolean | null>(null);

  // Verify tab - uses university name lookup (all universities, public)
  const [universities, setUniversities] = useState<University[]>([]);
  const [verifyUniv, setVerifyUniv] = useState('');
  const [verifyStudent, setVerifyStudent] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingUnis, setIsLoadingUnis] = useState(false);

  // Issue tab - only universities where connected wallet has admin or issuer role
  const [myUniversities, setMyUniversities] = useState<University[]>([]);
  const [isLoadingMyUnis, setIsLoadingMyUnis] = useState(false);
  const [certResult, setCertResult] = useState<{
    tokenId: string;
    candidateName: string;
    courseName: string;
    issuedAt: string;
    universityName: string;
    isRevoked: boolean;
    revocationReason: string;
    revocationDate: string;
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
  const [isRevoking, setIsRevoking] = useState(false);

  const showMsg = (type: Msg['type'], text: string) => setMsg({ type, text });

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

  const loadUniversities = async () => {
    setIsLoadingUnis(true);
    try {
      const provider = await getReadOnlyProvider();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const count = await factory.getUniversityCount();

      // Fetch all university addresses in parallel first
      const addressPromises = Array.from({ length: Number(count) }, (_, i) =>
        factory.deployedUniversities(i)
      );
      const addresses: string[] = await Promise.all(addressPromises);

      // Then fetch all names in parallel using Promise.all()
      const unis = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const univContract = new ethers.Contract(addr, UNIVERSITY_ABI, provider);
            const name = await univContract.name();
            return { address: addr, name };
          } catch (_e) {
            return { address: addr, name: `University (${addr.slice(0, 6)}...)` };
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

      // Fetch all university names in parallel using Promise.all()
      // All name() calls fire simultaneously instead of one by one
      const names = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const univContract = new ethers.Contract(addr, UNIVERSITY_ABI, provider);
            const name = await univContract.name();
            return { address: addr, name };
          } catch (_e) {
            return { address: addr, name: `University (${addr.slice(0, 6)}...)` };
          }
        })
      );

      setMyUniversities(names);
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Could not load your universities. Please try again.');
    } finally {
      setIsLoadingMyUnis(false);
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
      // Load only the universities this wallet has access to
      await loadMyUniversities(accounts[0]);
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
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      showMsg('info', 'Deploying university contract... Please confirm in MetaMask.');
      const tx = await factory.deployUniversity(fullName, univSymbol, univAdmin);
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

  const handleRevoke = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univAddress) { showMsg('error', 'Please select a programme first.'); return; }
    if (!ethers.isAddress(revokeAddress)) { showMsg('error', 'Please enter a valid student wallet address.'); return; }
    const finalReason = revokeReason === 'custom' ? customReason.trim() : revokeReason;
    if (!finalReason) { showMsg('error', 'Please select or enter a revocation reason.'); return; }
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
      setRevokeAddress('');
      setRevokeReason('');
      setCustomReason('');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsRevoking(false);
    }
  };

  const issueCertificate = async () => {
    if (!signer) { showMsg('error', 'Please connect your wallet first.'); return; }
    if (!univAddress || !studentAddress || !certificateName || !courseName) {
      showMsg('error', 'Please fill in all fields before issuing a certificate.'); return;
    }
    if (!ethers.isAddress(univAddress)) { showMsg('error', 'The university contract address is not valid.'); return; }
    if (!ethers.isAddress(studentAddress)) { showMsg('error', 'The student wallet address is not valid.'); return; }
    setIsIssuing(true);
    try {
      // Encrypt the student name and course before storing on blockchain
      showMsg('info', 'Encrypting certificate data...');
      const encryptedName = await encryptField(certificateName, univAddress, studentAddress);
      const encryptedCourse = await encryptField(courseName, univAddress, studentAddress);

      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, signer);
      const tokenURI = `ipfs://certificate/${studentAddress}`;
      showMsg('info', 'Issuing certificate... Please confirm in MetaMask.');
      const tx = await university.issueCertificate(studentAddress, tokenURI, encryptedName, encryptedCourse);
      await tx.wait();
      showMsg('success', `Certificate successfully issued to ${certificateName}! Their data is encrypted on the blockchain.`);
      setStudentAddress('');
      setCertificateName('');
      setCourseName('');
    } catch (error) {
      showMsg('error', parseError(error));
    } finally {
      setIsIssuing(false);
    }
  };

  const verifyCertificate = async () => {
    if (!verifyUniv) { showMsg('error', 'Please select a university.'); return; }
    if (!verifyStudent) { showMsg('error', 'Please enter the student wallet address.'); return; }
    if (!ethers.isAddress(verifyStudent)) { showMsg('error', 'The student wallet address is not valid. Please check and try again.'); return; }
    setIsVerifying(true);
    setCertResult(null);
    try {
      const provider = await getReadOnlyProvider();
      const university = new ethers.Contract(verifyUniv, UNIVERSITY_ABI, provider);
      const has = await university.hasCertificate(verifyStudent);
      if (!has) {
        showMsg('error', 'No certificate found for this student at the selected university.');
        setIsVerifying(false);
        return;
      }
      const tokenId = await university.studentToTokenId(verifyStudent);
      const [cert, revoked, reason, revDate] = await Promise.all([
        university.certificates(tokenId),
        university.isRevoked(verifyStudent),
        university.revocationReason(verifyStudent),
        university.revocationDate(verifyStudent),
      ]);
      const univName = universities.find(u => u.address.toLowerCase() === verifyUniv.toLowerCase())?.name || 'Unknown University';

      // Decrypt the name and course - works transparently for both
      // encrypted (new) and unencrypted (legacy) certificates
      const decryptedName = await decryptField(cert.candidateName, verifyUniv, verifyStudent);
      const decryptedCourse = await decryptField(cert.courseName, verifyUniv, verifyStudent);

      setCertResult({
        tokenId: tokenId.toString(),
        candidateName: decryptedName,
        courseName: decryptedCourse,
        issuedAt: new Date(Number(cert.issuanceDate) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        universityName: univName,
        isRevoked: revoked,
        revocationReason: reason,
        revocationDate: revoked && Number(revDate) > 0
          ? new Date(Number(revDate) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '',
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
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${account ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
          >
            {isConnecting ? 'Connecting...' : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
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

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg mb-8 border border-slate-700">
          {(['deploy', 'issue', 'verify'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setMsg(null); }}
              className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {tab === 'deploy' ? 'Register Programme' : tab === 'issue' ? 'Issue Certificate' : 'Verify Certificate'}
            </button>
          ))}
        </div>

        {/* Deploy University Tab */}
        {activeTab === 'deploy' && (
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
                <p className="text-xs text-slate-500 mt-2">This address uniquely identifies your programme on the blockchain.</p>
              </div>
            )}
          </div>
        )}

        {/* Issue Certificate Tab */}
        {activeTab === 'issue' && (
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
                <label className={labelClass}>Field of Study</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Engineering Physics"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  maxLength={120}
                />
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

            <div>
              <label className={labelClass}>Graduate Wallet Address</label>
              <input
                className={inputClass}
                placeholder="0x... (the graduate's wallet address)"
                value={verifyStudent}
                onChange={(e) => { setVerifyStudent(e.target.value); setCertResult(null); }}
              />
            </div>

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
                {/* Certificate details - always shown so verifier knows whose it was */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Graduate Name</p>
                    <p className={`font-medium ${certResult.isRevoked ? 'text-slate-400 line-through' : 'text-white'}`}>{certResult.candidateName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Field of Study</p>
                    <p className={`font-medium ${certResult.isRevoked ? 'text-slate-400 line-through' : 'text-white'}`}>{certResult.courseName}</p>
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
                  <a
                    href={`https://sepolia.etherscan.io/token/${verifyUniv}?a=${verifyStudent}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    View on Blockchain
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-slate-600 space-y-1">
          <p>Platform Registry: <span className="font-mono">{FACTORY_ADDRESS}</span></p>
          <p>Running on Sepolia Testnet</p>
        </div>
      </div>
    </main>
  );
}
