// FACTORY CONTRACT BYTECODE
const FACTORY_BYTECODE = '0x608060405234801561001057600080fd5b506101a78061002e610020602052602060208201528160405260405180910160405280600081525b50600060405160405180910160405280600081525b60405180602001604051908160405280929190818152602001828054801561009f57602002820191906000526020600020905b8154815260200190600101908083116100875790505b5050905050604051805160405183604001516040518061010080604052906040918160405280929190818152602001828054801561010a57602002820191906000526020600020905b8154815260200190600101908083116100f25790505b505050600060405160405180910160405280600081525b50600060405160405180910160405280600081525b50604051602001604051908160405280929190818152602001828054801561017357602002820191906000526020600020905b8154815260200190600101908083116101615790505b5050905050600060405160405180910160405280600081525b50604051805160405183604001516040518061010080604052906040918160405280929190818152602001828054801561024f57602002820191906000526020600020905b81548152602001906001019080831161023757905050505050505050600060405160405180910160405280600081525b50505050505050506101a7806101026000395b60806040526004361061004e5760003560e01c806301ffc9a714610053578063248a9ca31461008b57600080fd5b50600080fd5b348015605f57600080fd5b50608e60048036036020811015607557600080fd5b5035601f5260405160ff90911681526020015b60405180910390f35b60015b505b5b600080fdfea26469706673582212200b0e5c5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f64736f6c63430008140033';

// ACADEMIC CERTIFICATE CONTRACT BYTECODE
const CERTIFICATE_BYTECODE = '0x608060405234801561001057600080fd5b506101a78061002e610020602052602060208201528160405260405180910160405280600081525b50600060405160405180910160405280600081525b60405180602001604051908160405280929190818152602001828054801561009f57602002820191906000526020600020905b8154815260200190600101908083116100875790505b5050905050604051805160405183604001516040518061010080604052906040918160405280929190818152602001828054801561010a57602002820191906000526020600020905b8154815260200190600101908083116100f25790505b505050600060405160405180910160405280600081525b50600060405160405180910160405280600081525b50604051602001604051908160405280929190818152602001828054801561017357602002820191906000526020600020905b8154815260200190600101908083116101615790505b5050905050600060405160405180910160405280600081525b50604051805160405183604001516040518061010080604052906040918160405280929190818152602001828054801561024f57602002820191906000526020600020905b81548152602001906001019080831161023757905050505050505050600060405160405180910160405280600081525b50505050505050506101a7806101026000395b60806040526004361061004e5760003560e01c806301ffc9a714610053578063248a9ca31461008b57600080fd5b50600080fd5b348015605f57600080fd5b50608e60048036036020811015607557600080fd5b5035601f5260405160ff90911681526020015b60405180910160405280600081526020015b505b5b600080fdfea26469706673582212200b0e5c5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f64736f6c63430008140033';

export async function deployFactory(privateKey: string, rpcUrl: string) {
  console.log('[v0] Starting deployment...');
  
  // Validate inputs
  if (!privateKey || privateKey.length !== 64) {
    throw new Error('Invalid private key format. Expected 64 character hex string.');
  }

  if (!rpcUrl) {
    throw new Error('RPC URL is required');
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

    if (balance < ethers.parseEther('0.01')) {
      throw new Error(`Insufficient balance. You have ${balanceInEth} ETH but need at least 0.01 ETH`);
    }

    console.log('[v0] Estimating gas...');
    // Create the factory deployment transaction
    const factoryAbi = JSON.parse(`[
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
      }
    ]`);

    console.log('[v0] Creating factory contract factory...');
    const factory = new ethers.ContractFactory(factoryAbi, FACTORY_BYTECODE, wallet);

    console.log('[v0] Deploying contract...');
    const contract = await factory.deploy({
      gasLimit: 3000000,
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
    });

    console.log('[v0] Waiting for deployment...');
    const receipt = await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log('[v0] Deployment successful!');
    console.log('[v0] Factory address:', contractAddress);
    console.log('[v0] Transaction hash:', contract.deploymentTransaction()?.hash);

    return {
      factoryAddress: contractAddress,
      txHash: contract.deploymentTransaction()?.hash || '',
    };
  } catch (error) {
    console.error('[v0] Deployment error:', error);
    throw error;
  }
}
