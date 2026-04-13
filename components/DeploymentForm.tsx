'use client';

import { useState, FormEvent } from 'react';
import { deployFactory } from '@/lib/deploy';

interface DeploymentFormProps {
  onDeployment: (state: {
    status: 'idle' | 'deploying' | 'success' | 'error';
    factoryAddress?: string;
    error?: string;
    txHash?: string;
  }) => void;
}

export default function DeploymentForm({ onDeployment }: DeploymentFormProps) {
  const [privateKey, setPrivateKey] = useState('');
  const [rpcUrl, setRpcUrl] = useState('https://eth-sepolia.g.alchemy.com/v2/');
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    onDeployment({ status: 'deploying' });

    try {
      if (!privateKey.trim()) {
        throw new Error('Private key is required');
      }
      if (!rpcUrl.trim()) {
        throw new Error('RPC URL is required');
      }

      console.log('[v0] Starting deployment with key and RPC');
      const result = await deployFactory(privateKey, rpcUrl);
      console.log('[v0] Deployment result:', result);

      onDeployment({
        status: 'success',
        factoryAddress: result.factoryAddress,
        txHash: result.txHash,
      });
    } catch (error) {
      console.log('[v0] Deployment error:', error);
      onDeployment({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-effect p-8 rounded-lg space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white">Deploy Factory Contract</h2>

      {/* Private Key Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Private Key (without 0x prefix)
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="fae206342ebf900ae8c7eb48eb84061b5e..."
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
          >
            {showKey ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">🔒 Your key stays in your browser only</p>
      </div>

      {/* RPC URL Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Sepolia RPC URL
        </label>
        <input
          type="text"
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          placeholder="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition font-mono text-sm"
        />
        <p className="text-xs text-slate-500 mt-1">Get a free one from <a href="https://alchemy.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Alchemy</a></p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="animate-spin">⚙️</div>
            Deploying...
          </>
        ) : (
          <>
            🚀 Deploy Factory
          </>
        )}
      </button>

      {/* Instructions */}
      <div className="bg-slate-700/30 p-4 rounded-lg text-sm text-slate-300 space-y-2">
        <p className="font-semibold text-slate-200">Requirements:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>At least 0.01 Sepolia ETH in your wallet</li>
          <li>Valid Sepolia RPC URL (from Alchemy, Infura, etc.)</li>
          <li>Your private key (256-bit hex string)</li>
        </ul>
      </div>
    </form>
  );
}
