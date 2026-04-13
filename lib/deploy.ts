export async function deployFactory(privateKey: string, rpcUrl: string, bytecode: string) {
  console.log('[v0] Starting deployment...');
  
  // Validate inputs
  if (!privateKey || privateKey.length !== 64) {
    throw new Error('Invalid private key format. Expected 64 character hex string.');
  }

  if (!rpcUrl) {
    throw new Error('RPC URL is required');
  }

  // Validate and normalize bytecode
  let normalizedBytecode = bytecode.trim();
  if (!normalizedBytecode.startsWith('0x')) {
    normalizedBytecode = '0x' + normalizedBytecode;
  }

  console.log('[v0] Bytecode length:', normalizedBytecode.length, 'characters');
  console.log('[v0] Bytecode size:', (normalizedBytecode.length - 2) / 2, 'bytes');

  if (normalizedBytecode.length < 4) {
    throw new Error('Bytecode appears to be invalid (too short)');
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

    // Simple deployment - just send the bytecode as a contract creation transaction
    console.log('[v0] Creating deployment transaction...');
    
    const deployTx = {
      data: normalizedBytecode,
      gasLimit: 10000000,
      maxFeePerGas: ethers.parseUnits('3', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
    };

    console.log('[v0] Sending deployment transaction...');
    const tx = await wallet.sendTransaction(deployTx);
    console.log('[v0] Transaction hash:', tx.hash);
    console.log('[v0] Waiting for confirmation...');

    const receipt = await tx.wait();
    
    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    if (receipt.status === 0) {
      throw new Error('Transaction reverted. The bytecode may be invalid or the contract constructor failed. Check the bytecode from Remix carefully.');
    }

    const contractAddress = receipt.contractAddress;

    if (!contractAddress) {
      throw new Error('No contract address in receipt');
    }

    console.log('[v0] Deployment successful!');
    console.log('[v0] Factory address:', contractAddress);
    console.log('[v0] Transaction hash:', tx.hash);

    return {
      factoryAddress: contractAddress,
      txHash: tx.hash,
    };
  } catch (error) {
    console.error('[v0] Deployment error:', error);
    if (error instanceof Error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
    throw new Error('Deployment failed: Unknown error');
  }
}
