'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

const FACTORY_ADDRESS = '0xf729BBf09B236068d40ef9d50A515d78C02f3e59';
const SEPOLIA_CHAIN_ID = BigInt(11155111);

const FACTORY_ABI = [
  'function deployUniversity(string memory universityName, string memory symbol, address universityAdmin) external returns (address)',
  'function getUniversities() external view returns (address[])',
  'function getUniversityCount() external view returns (uint256)',
];

const UNIVERSITY_ABI = [
  'function issueCertificate(address student, string memory _tokenURI, string memory _candidateName, string memory _courseName) external returns (uint256)',
  'function getCertificate(address student) external view returns (uint256 tokenId, string memory candidateName, string memory courseName, uint256 issuedAt, bool isRevoked)',
  'function hasCertificate(address student) external view returns (bool)',
];

type Msg = { type: 'success' | 'error' | 'info'; text: string };

export default function Dashboard() {
  const [account, setAccount] = useState('');
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'deploy' | 'issue' | 'verify'>('deploy');
  const [msg, setMsg] = useState<Msg | null>(null);

  const [univName, setUnivName] = useState('');
  const [univSymbol, setUnivSymbol] = useState('');
  const [univAdmin, setUnivAdmin] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUnivAddress, setDeployedUnivAddress] = useState('');

  const [univAddress, setUnivAddress] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  const [verifyStudent, setVerifyStudent] = useState('');
  const [verifyUniv, setVerifyUniv] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [certResult, setCertResult] = useState<{
    tokenId: string;
    candidateName: string;
    courseName: string;
    issuedAt: string;
  } | null>(null);

  const showMsg = (type: Msg['type'], text: string) => setMsg({ type, text });

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const win = window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]>; on: (e: string, cb: () => void) => void } };
      if (!win.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');

      const provider = new ethers.BrowserProvider(win.ethereum);
      const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
      const network = await provider.getNetwork();

      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        throw new Error('Wrong network. Please switch MetaMask to Sepolia Testnet.');
      }

      const s = await provider.getSigner();
      setSigner(s);
      setAccount(accounts[0]);
      showMsg('success', 'Wallet connected to Sepolia!');
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const deployUniversity = async () => {
    if (!signer) { showMsg('error', 'Connect your wallet first'); return; }
    if (!univName || !univSymbol || !univAdmin) { showMsg('error', 'Please fill in all fields'); return; }
    setIsDeploying(true);
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      showMsg('info', 'Deploying university contract...');
      const tx = await factory.deployUniversity(univName, univSymbol, univAdmin);
      const receipt = await tx.wait();
      const univAddr = receipt.logs[0]?.address || 'Check transaction on Etherscan';
      setDeployedUnivAddress(univAddr);
      showMsg('success', `University deployed! Address: ${univAddr}`);
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const issueCertificate = async () => {
    if (!signer) { showMsg('error', 'Connect your wallet first'); return; }
    if (!univAddress || !studentAddress || !certificateName || !courseName) { showMsg('error', 'Please fill in all fields'); return; }
    setIsIssuing(true);
    try {
      const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, signer);
      const tokenURI = `ipfs://certificate/${studentAddress}`;
      showMsg('info', 'Issuing certificate...');
      const tx = await university.issueCertificate(studentAddress, tokenURI, certificateName, courseName);
      await tx.wait();
      showMsg('success', `Certificate issued to ${studentAddress.slice(0, 6)}...${studentAddress.slice(-4)}!`);
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Issue failed');
    } finally {
      setIsIssuing(false);
    }
  };

  const verifyCertificate = async () => {
    if (!verifyUniv || !verifyStudent) { showMsg('error', 'Please fill in all fields'); return; }
    setIsVerifying(true);
    setCertResult(null);
    try {
      const win = window as unknown as { ethereum?: object };
      if (!win.ethereum) throw new Error('MetaMask not found');
      const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
      const university = new ethers.Contract(verifyUniv, UNIVERSITY_ABI, provider);
      const has = await university.hasCertificate(verifyStudent);
      if (!has) { showMsg('error', 'No certificate found for this student'); setIsVerifying(false); return; }
      const cert = await university.getCertificate(verifyStudent);
      setCertResult({
        tokenId: cert.tokenId.toString(),
        candidateName: cert.candidateName,
        courseName: cert.courseName,
        issuedAt: new Date(Number(cert.issuedAt) * 1000).toLocaleDateString(),
      });
      showMsg('success', 'Certificate verified successfully!');
    } catch (error) {
      showMsg('error', error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1';
  const btnClass = 'w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <main className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">PAX Certificate System</h1>
            <p className="text-xs text-slate-400">Soulbound NFT Academic Certificates</p>
          </div>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${account ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
          >
            {isConnecting ? 'Connecting...' : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Message Banner */}
        {msg && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-green-900/50 border border-green-600 text-green-300' : msg.type === 'error' ? 'bg-red-900/50 border border-red-600 text-red-300' : 'bg-blue-900/50 border border-blue-600 text-blue-300'}`}>
            <div className="flex justify-between items-start">
              <span>{msg.text}</span>
              <button onClick={() => setMsg(null)} className="ml-4 opacity-60 hover:opacity-100">x</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg mb-8">
          {(['deploy', 'issue', 'verify'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab === 'deploy' ? 'Deploy University' : tab === 'issue' ? 'Issue Certificate' : 'Verify Certificate'}
            </button>
          ))}
        </div>

        {/* Deploy University Tab */}
        {activeTab === 'deploy' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-bold mb-1">Deploy University Contract</h2>
            <p className="text-slate-400 text-sm mb-6">Create a new certificate contract for your institution via the Factory.</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>University Name</label>
                <input className={inputClass} placeholder="e.g. Harvard University" value={univName} onChange={(e) => setUnivName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Token Symbol</label>
                <input className={inputClass} placeholder="e.g. HARV" value={univSymbol} onChange={(e) => setUnivSymbol(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Admin Wallet Address</label>
                <input className={inputClass} placeholder="0x..." value={univAdmin} onChange={(e) => setUnivAdmin(e.target.value)} />
              </div>
              <button onClick={deployUniversity} disabled={isDeploying} className={`${btnClass} bg-blue-600 hover:bg-blue-700`}>
                {isDeploying ? 'Deploying...' : 'Deploy University'}
              </button>
              {deployedUnivAddress && (
                <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">University Contract Address:</p>
                  <p className="font-mono text-green-400 text-sm break-all">{deployedUnivAddress}</p>
                  <p className="text-xs text-slate-500 mt-2">Save this address to issue certificates!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Issue Certificate Tab */}
        {activeTab === 'issue' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-bold mb-1">Issue Certificate</h2>
            <p className="text-slate-400 text-sm mb-6">Mint a soulbound NFT certificate to a student&apos;s wallet.</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>University Contract Address</label>
                <input className={inputClass} placeholder="0x..." value={univAddress} onChange={(e) => setUnivAddress(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Student Wallet Address</label>
                <input className={inputClass} placeholder="0x..." value={studentAddress} onChange={(e) => setStudentAddress(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Student Full Name</label>
                <input className={inputClass} placeholder="e.g. John Doe" value={certificateName} onChange={(e) => setCertificateName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Course / Degree Name</label>
                <input className={inputClass} placeholder="e.g. BSc Computer Science" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
              </div>
              <button onClick={issueCertificate} disabled={isIssuing} className={`${btnClass} bg-green-600 hover:bg-green-700`}>
                {isIssuing ? 'Issuing...' : 'Issue Certificate'}
              </button>
            </div>
          </div>
        )}

        {/* Verify Certificate Tab */}
        {activeTab === 'verify' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-bold mb-1">Verify Certificate</h2>
            <p className="text-slate-400 text-sm mb-6">Publicly verify any student&apos;s certificate on the blockchain.</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>University Contract Address</label>
                <input className={inputClass} placeholder="0x..." value={verifyUniv} onChange={(e) => setVerifyUniv(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Student Wallet Address</label>
                <input className={inputClass} placeholder="0x..." value={verifyStudent} onChange={(e) => setVerifyStudent(e.target.value)} />
              </div>
              <button onClick={verifyCertificate} disabled={isVerifying} className={`${btnClass} bg-purple-600 hover:bg-purple-700`}>
                {isVerifying ? 'Verifying...' : 'Verify Certificate'}
              </button>
              {certResult && (
                <div className="mt-4 p-4 bg-slate-700 rounded-lg border border-slate-600 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-green-400 font-semibold text-sm">Certificate Verified</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs">Token ID</p>
                      <p className="font-mono text-white">#{certResult.tokenId}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Issued Date</p>
                      <p className="text-white">{certResult.issuedAt}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Student Name</p>
                      <p className="text-white">{certResult.candidateName}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Course</p>
                      <p className="text-white">{certResult.courseName}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Factory Contract: <span className="font-mono text-slate-400">{FACTORY_ADDRESS}</span></p>
          <p className="mt-1">Running on Sepolia Testnet</p>
        </div>
      </div>
    </main>
  );
}
