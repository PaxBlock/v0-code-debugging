'use client';

import { useState } from 'react';
import type { BrowserProvider, Signer, Contract } from 'ethers';
import { ethers } from 'ethers';

const FACTORY_ADDRESS = '0xf729BBf09B236068d40ef9d50A515d78C02f3e59';
const SEPOLIA_CHAIN_ID = 11155111;

// Factory ABI - simplified for main functions
const FACTORY_ABI = [
  {
    name: 'deployUniversity',
    inputs: [
      { name: 'universityName', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'universityAdmin', type: 'address' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    name: 'getUniversities',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'getUniversityCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const CERTIFICATE_ABI = [
  {
    name: 'issueCertificate',
    inputs: [
      { name: 'student', type: 'address' },
      { name: '_tokenURI', type: 'string' },
      { name: '_candidateName', type: 'string' },
      { name: '_courseName', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    name: 'getCertificateByStudent',
    inputs: [{ name: 'student', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'candidateName', type: 'string' },
      { name: 'courseName', type: 'string' },
      { name: 'issuedDate', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export default function Dashboard() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'deploy' | 'issue' | 'verify'>('deploy');

  // Deploy University state
  const [univName, setUnivName] = useState('');
  const [univSymbol, setUnivSymbol] = useState('');
  const [univAdmin, setUnivAdmin] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  // Issue Certificate state
  const [univAddress, setUnivAddress] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  // Verify Certificate state
  const [verifyStudent, setVerifyStudent] = useState('');
  const [verifyUniv, setVerifyUniv] = useState('');
  const [certificate, setCertificate] = useState<{
    tokenId: string;
    candidateName: string;
    courseName: string;
    issuedDate: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Connect Wallet
  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const ethereumWindow = window as unknown as {
        ethereum?: {
          request: (args: { method: string }) => Promise<string[]>;
        };
      };

      if (!ethereumWindow.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const p = new ethers.BrowserProvider(ethereumWindow.ethereum);
      const accounts = await ethereumWindow.ethereum.request({ method: 'eth_requestAccounts' });
      const s = await p.getSigner();

      const network = await p.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        throw new Error('Please switch to Sepolia testnet in MetaMask');
      }

      setProvider(p);
      setSigner(s);
      setAccount(accounts[0]);
      setMessage({ type: 'success', text: 'Wallet connected!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Connection failed' });
    } finally {
      setIsConnecting(false);
    }
  };

  // Deploy University
  const deployUniversity = async () => {
    if (!signer || !account) {
      setMessage({ type: 'error', text: 'Wallet not connected' });
      return;
    }

    setIsDeploying(true);
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const tx = await factory.deployUniversity(univName, univSymbol, univAdmin || account);
      const receipt = await tx.wait();

      setMessage({ type: 'success', text: `University deployed! Tx: ${receipt?.hash}` });
      setUnivName('');
      setUnivSymbol('');
      setUnivAdmin('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Deployment failed' });
    } finally {
      setIsDeploying(false);
    }
  };

  // Issue Certificate
  const issueCertificate = async () => {
    if (!signer) {
      setMessage({ type: 'error', text: 'Wallet not connected' });
      return;
    }

    setIsIssuing(true);
    try {
      const certContract = new ethers.Contract(univAddress, CERTIFICATE_ABI, signer);
      const tokenURI = `ipfs://Qm${Date.now()}`; // Placeholder - in production use real IPFS
      const tx = await certContract.issueCertificate(
        studentAddress,
        tokenURI,
        certificateName,
        courseName
      );
      const receipt = await tx.wait();

      setMessage({ type: 'success', text: `Certificate issued! Tx: ${receipt?.hash}` });
      setStudentAddress('');
      setCertificateName('');
      setCourseName('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Issue failed' });
    } finally {
      setIsIssuing(false);
    }
  };

  // Verify Certificate
  const verifyCertificate = async () => {
    if (!provider) {
      setMessage({ type: 'error', text: 'Provider not connected' });
      return;
    }

    setIsVerifying(true);
    try {
      const certContract = new ethers.Contract(verifyUniv, CERTIFICATE_ABI, provider);
      const cert = await certContract.getCertificateByStudent(verifyStudent);
      setCertificate({
        tokenId: cert.tokenId.toString(),
        candidateName: cert.candidateName,
        courseName: cert.courseName,
        issuedDate: new Date(cert.issuedDate.toNumber() * 1000).toLocaleDateString(),
      });
      setMessage({ type: 'success', text: 'Certificate found!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Verification failed' });
      setCertificate(null);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Academic Certificates
            </h1>
            <p className="text-slate-400 mt-2">Manage Soulbound NFT Certificates</p>
          </div>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
          >
            {isConnecting ? 'Connecting...' : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/20 text-green-200 border border-green-600/30'
                : message.type === 'error'
                  ? 'bg-red-900/20 text-red-200 border border-red-600/30'
                  : 'bg-blue-900/20 text-blue-200 border border-blue-600/30'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          {(['deploy', 'issue', 'verify'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === tab
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {tab === 'deploy' && 'Deploy University'}
              {tab === 'issue' && 'Issue Certificate'}
              {tab === 'verify' && 'Verify Certificate'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-8">
          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">Deploy New University</h2>
              <input
                type="text"
                placeholder="University Name (e.g., Harvard University)"
                value={univName}
                onChange={(e) => setUnivName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="Symbol (e.g., HARV)"
                value={univSymbol}
                onChange={(e) => setUnivSymbol(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="Admin Address (optional, defaults to your wallet)"
                value={univAdmin}
                onChange={(e) => setUnivAdmin(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={deployUniversity}
                disabled={isDeploying || !account || !univName || !univSymbol}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
              >
                {isDeploying ? 'Deploying...' : 'Deploy University'}
              </button>
            </div>
          )}

          {activeTab === 'issue' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">Issue Certificate</h2>
              <input
                type="text"
                placeholder="University Contract Address"
                value={univAddress}
                onChange={(e) => setUnivAddress(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
              />
              <input
                type="text"
                placeholder="Student Address"
                value={studentAddress}
                onChange={(e) => setStudentAddress(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
              />
              <input
                type="text"
                placeholder="Candidate Name"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                placeholder="Course Name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={issueCertificate}
                disabled={isIssuing || !account || !univAddress || !studentAddress || !certificateName || !courseName}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
              >
                {isIssuing ? 'Issuing...' : 'Issue Certificate'}
              </button>
            </div>
          )}

          {activeTab === 'verify' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">Verify Certificate</h2>
              <input
                type="text"
                placeholder="University Contract Address"
                value={verifyUniv}
                onChange={(e) => setVerifyUniv(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
              />
              <input
                type="text"
                placeholder="Student Address"
                value={verifyStudent}
                onChange={(e) => setVerifyStudent(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
              />
              <button
                onClick={verifyCertificate}
                disabled={isVerifying || !verifyUniv || !verifyStudent}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
              >
                {isVerifying ? 'Verifying...' : 'Verify Certificate'}
              </button>

              {certificate && (
                <div className="mt-6 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-200 mb-3">Certificate Details</h3>
                  <div className="space-y-2 text-green-100 text-sm">
                    <p>
                      <strong>Token ID:</strong> {certificate.tokenId}
                    </p>
                    <p>
                      <strong>Candidate:</strong> {certificate.candidateName}
                    </p>
                    <p>
                      <strong>Course:</strong> {certificate.courseName}
                    </p>
                    <p>
                      <strong>Issued Date:</strong> {certificate.issuedDate}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Factory Info */}
        <div className="mt-8 p-4 bg-slate-700/30 rounded-lg text-slate-300 text-sm">
          <p>
            <strong>Factory Address:</strong>
            {' '}
            <code className="font-mono">{FACTORY_ADDRESS}</code>
          </p>
          <p className="mt-2">
            <strong>Network:</strong> Sepolia Testnet
          </p>
        </div>
      </div>
    </main>
  );
}
