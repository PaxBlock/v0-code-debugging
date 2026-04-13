'use client';

export default function Header() {
  return (
    <header className="relative backdrop-blur-md border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              🎓 Academic Certificate Deployer
            </h1>
            <p className="text-slate-400 mt-2">Deploy your soulbound NFT certificate contract to Sepolia testnet</p>
          </div>
        </div>
      </div>
    </header>
  );
}
