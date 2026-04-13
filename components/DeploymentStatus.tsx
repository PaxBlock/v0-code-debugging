'use client';

interface DeploymentStatusProps {
  deployment: {
    status: 'idle' | 'deploying' | 'success' | 'error';
    factoryAddress?: string;
    error?: string;
    txHash?: string;
  };
}

export default function DeploymentStatus({ deployment }: DeploymentStatusProps) {
  if (deployment.status === 'idle') {
    return (
      <div className="glass-effect p-8 rounded-lg h-full min-h-[300px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-slate-300">Fill out the form and deploy your factory contract</p>
        </div>
      </div>
    );
  }

  if (deployment.status === 'deploying') {
    return (
      <div className="glass-effect p-8 rounded-lg">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-2xl">⚙️</div>
            <h3 className="text-lg font-semibold text-cyan-400">Deploying...</h3>
          </div>
          <p className="text-slate-300 text-sm">Your contract is being deployed to Sepolia. This may take 30-60 seconds.</p>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (deployment.status === 'error') {
    return (
      <div className="glass-effect p-8 rounded-lg border-l-4 border-red-500">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-red-400">❌ Deployment Failed</h3>
          <div className="bg-red-900/20 p-4 rounded text-red-200 text-sm font-mono break-words">
            {deployment.error}
          </div>
          <p className="text-xs text-slate-400">Check your private key and RPC URL, then try again.</p>
        </div>
      </div>
    );
  }

  if (deployment.status === 'success') {
    return (
      <div className="glass-effect p-8 rounded-lg border-l-4 border-green-500 space-y-4">
        <h3 className="text-lg font-semibold text-green-400">✅ Deployment Successful!</h3>
        
        <div className="space-y-3 bg-slate-700/30 p-4 rounded">
          <div>
            <p className="text-xs text-slate-400 mb-1">Factory Contract Address:</p>
            <div className="bg-slate-800 p-3 rounded font-mono text-sm text-cyan-400 break-all">
              {deployment.factoryAddress}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(deployment.factoryAddress || '');
                alert('Address copied to clipboard!');
              }}
              className="mt-2 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-3 py-1 rounded transition"
            >
              📋 Copy Address
            </button>
          </div>

          {deployment.txHash && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Transaction Hash:</p>
              <div className="bg-slate-800 p-3 rounded font-mono text-sm text-slate-400 break-all">
                {deployment.txHash}
              </div>
              <a
                href={`https://sepolia.etherscan.io/tx/${deployment.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded inline-block transition"
              >
                🔍 View on Etherscan
              </a>
            </div>
          )}
        </div>

        <div className="bg-green-900/20 border border-green-600/30 p-4 rounded text-sm text-green-200">
          <p className="font-semibold mb-2">Next Steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Save your Factory Address above</li>
            <li>Use it in your UI to deploy universities</li>
            <li>Universities can then issue certificates</li>
          </ol>
        </div>
      </div>
    );
  }
}
