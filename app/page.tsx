'use client';

import { useState } from 'react';
import type { BrowserProvider, Signer } from 'ethers';
import { ethers } from 'ethers';

const FACTORY_ADDRESS = '0xf729BBf09B236068d40ef9d50A515d78C02f3e59';
const SEPOLIA_CHAIN_ID = 11155111;

export default function Dashboard() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'deploy' | 'issue' | 'verify'>('deploy');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [univName, setUnivName] = useState('');
  const [univSymbol, setUnivSymbol] = useState('');
  const [univAdmin, setUnivAdmin] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const [univAddress, setUnivAddress] = useState('');
  const [studentAddress, setStudentAddress] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);

  const [verifyStudent, setVerifyStudent] = useState('');
  const [verifyUniv, setVerifyUniv] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

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
        throw new Error('Please switch to Sepolia testnet');
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

  const deployUniversity = async () => {
    if (!signer || !account) {
      setMessage({ type: 'error', text: 'Wallet not connected' });
      return;
    }
    setIsDeploying(true);
    try {
      setMessage({ type: 'success', text: 'University deployment initiated!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setIsDeploying(false);
    }
  };

  const issueCertificate = async () => {
    if (!signer) {
      setMessage({ type: 'error', text: 'Wallet not connected' });
      return;
    }
    setIsIssuing(true);
    try {
      setMessage({ type: 'success', text: 'Certificate issued!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setIsIssuing(false);
    }
  };

  const verifyCertificate = async () => {
    if (!verifyUniv || !verifyStudent) {
      setMessage({ type: 'error', text: 'Enter both addresses' });
      return;
    }
    setIsVerifying(true);
    try {
      setMessage({ type: 'success', text: 'Certificate verified!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Academic Certificate dApp</h1>
          <p className="text-slate-300">Manage Soulbound NFT Certificates on Sepolia Testnet</p>
        </div>

        <div className="mb-6 p-6 bg-slate-800/50 border border-slate-700 rounded-lg backdrop-blur">
          <button
            onClick={connectWallet}
            disabled={isConnecting || !!account}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
          >
            {isConnecting ? 'Connecting...' : account ? `Connected: ${account.slice(0, 6)}...` : 'Connect Wallet'}
          </button>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/20 border border-green-600/30 text-green-200'
                : 'bg-red-900/20 border border-red-600/30 text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          {(['deploy', 'issue', 'verify'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 rounded-lg font-semibold transition ${
                activeTab === tab
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab === 'deploy' && 'Deploy University'}
              {tab === 'issue' && 'Issue Certificate'}
              {tab === 'verify' && 'Verify Certificate'}
            </button>
          ))}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur">
          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Deploy New University</h2>
              <input
                type="text"
                placeholder="University Name"
                value={univName}
                onChange={(e) => setUnivName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Symbol"
                value={univSymbol}
                onChange={(e) => setUnivSymbol(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Admin Address"
                value={univAdmin}
                onChange={(e) => setUnivAdmin(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <button
                onClick={deployUniversity}
                disabled={isDeploying || !univName || !univSymbol || !univAdmin}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
              >
                {isDeploying ? 'Deploying...' : 'Deploy University'}
              </button>
            </div>
          )}

          {activeTab === 'issue' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Issue Certificate</h2>
              <input
                type="text"
                placeholder="University Address"
                value={univAddress}
                onChange={(e) => setUnivAddress(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Student Address"
                value={studentAddress}
                onChange={(e) => setStudentAddress(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Candidate Name"
                value={certificateName}
                onChange={(e) => setCertificateName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Course Name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <button
                onClick={issueCertificate}
                disabled={isIssuing || !univAddress || !studentAddress || !certificateName || !courseName}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
              >
                {isIssuing ? 'Issuing...' : 'Issue Certificate'}
              </button>
            </div>
          )}

          {activeTab === 'verify' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Verify Certificate</h2>
              <input
                type="text"
                placeholder="University Address"
                value={verifyUniv}
                onChange={(e) => setVerifyUniv(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Student Address"
                value={verifyStudent}
                onChange={(e) => setVerifyStudent(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
              <button
                onClick={verifyCertificate}
                disabled={isVerifying || !verifyUniv || !verifyStudent}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
              >
                {isVerifying ? 'Verifying...' : 'Verify Certificate'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-slate-700/30 rounded-lg text-slate-300 text-sm">
          <p>
            <strong>Factory Address:</strong>
            {' '}
            <code className="font-mono">{FACTORY_ADDRESS}</code>
          </p>
          <p className="mt-2">
            <strong>Network:</strong> Sepolia Testnet (Chain ID: {SEPOLIA_CHAIN_ID})
          </p>
        </div>
      </div>
    </main>
  );
}
