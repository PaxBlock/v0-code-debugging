'use client';

import { useState } from 'react';
import DeploymentForm from '@/components/DeploymentForm';
import Header from '@/components/Header';
import DeploymentStatus from '@/components/DeploymentStatus';

export default function Home() {
  const [deployment, setDeployment] = useState<{
    status: 'idle' | 'deploying' | 'success' | 'error';
    factoryAddress?: string;
    error?: string;
    txHash?: string;
  }>({
    status: 'idle',
  });

  return (
    <main className="min-h-screen">
      <Header />
      
      <div className="relative">
        {/* Background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left side - Deployment Form */}
            <div className="animate-fade-in">
              <DeploymentForm onDeployment={setDeployment} />
            </div>

            {/* Right side - Status & Info */}
            <div className="space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <DeploymentStatus deployment={deployment} />
              
              {/* Info Card */}
              <div className="glass-effect p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 gradient-text">How It Works</h3>
                <ol className="space-y-3 text-sm text-slate-300">
                  <li className="flex gap-3">
                    <span className="text-cyan-400 font-bold flex-shrink-0">1</span>
                    <span>Enter your private key and Sepolia RPC URL</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-cyan-400 font-bold flex-shrink-0">2</span>
                    <span>Click "Deploy Factory" to deploy the UniversityFactory contract</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-cyan-400 font-bold flex-shrink-0">3</span>
                    <span>Save the Factory Address for your UI</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-cyan-400 font-bold flex-shrink-0">4</span>
                    <span>Use the Factory to deploy universities with certificates</span>
                  </li>
                </ol>
              </div>

              {/* Security Notice */}
              <div className="bg-amber-900/20 border border-amber-600/30 p-4 rounded-lg">
                <p className="text-xs text-amber-200">
                  ⚠️ Your private key stays in your browser only. Never share your private key with anyone. After deployment, we recommend rotating this key.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
