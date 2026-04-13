export async function deployFactory(privateKey: string, rpcUrl: string, bytecode: string) {
  console.log('[v0] Starting deployment...');
  
  // Validate inputs
  if (!privateKey || privateKey.length !== 64) {
    throw new Error('Invalid private key format. Expected 64 character hex string.');
  }

  if (!rpcUrl) {
    throw new Error('RPC URL is required');
  }

  if (!bytecode || !bytecode.startsWith('0x')) {
    throw new Error('Invalid bytecode. Must start with 0x');
  }

  // Dynamically import ethers
  const ethers = await import('ethers');

  try {
    console.log('[v0] Creating provider...');
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Test connection
    const network = await provider.getNetwork();
    console.log('[v0] Connected to network:', network.name, 'Chain ID:', network.chainId);

    if (network.chainId !== 11155111n) {
      throw new Error(`Wrong network. Expected Sepolia (chainId 11155111), but got ${network.chainId}`);
    }

    console.log('[v0] Creating wallet...');
    const wallet = new ethers.Wallet(`0x${privateKey}`, provider);
    console.log('[v0] Deploying from address:', wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);
    console.log('[v0] Account balance:', balanceInEth, 'ETH');

    if (balance < ethers.parseEther('0.001')) {
      throw new Error(`Insufficient balance. You have ${balanceInEth} ETH but need at least 0.001 ETH`);
    }

    // FACTORY CONTRACT ABI
    const factoryAbi = [
      {
        "type": "constructor",
        "inputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "deployUniversity",
        "inputs": [
          {"name": "universityName", "type": "string"},
          {"name": "symbol", "type": "string"},
          {"name": "universityAdmin", "type": "address"}
        ],
        "outputs": [{"type": "address"}],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "getUniversityCount",
        "inputs": [],
        "outputs": [{"type": "uint256"}],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "getUniversities",
        "inputs": [],
        "outputs": [{"type": "address[]"}],
        "stateMutability": "view"
      }
    ];

    console.log('[v0] Creating contract factory...');
    const contractFactory = new ethers.ContractFactory(factoryAbi, bytecode, wallet);

    console.log('[v0] Deploying contract with gas settings...');
    const deployTx = await contractFactory.deploy({
      gasLimit: 5000000,
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
    });

    console.log('[v0] Transaction sent:', deployTx.deploymentTransaction()?.hash);
    console.log('[v0] Waiting for deployment confirmation...');
    
    const deployedContract = await deployTx.waitForDeployment();
    const contractAddress = await deployedContract.getAddress();

    const txHash = deployTx.deploymentTransaction()?.hash;
    console.log('[v0] Deployment successful!');
    console.log('[v0] Factory address:', contractAddress);
    console.log('[v0] Transaction hash:', txHash);

    return {
      factoryAddress: contractAddress,
      txHash: txHash || '',
    };
  } catch (error) {
    console.error('[v0] Deployment error:', error);
    if (error instanceof Error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
    throw new Error('Deployment failed: Unknown error');
  }
}
