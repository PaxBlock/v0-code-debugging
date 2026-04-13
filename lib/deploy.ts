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

    // FACTORY CONTRACT ABI - The actual interface of your Factory
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

    // The actual compiled bytecode from your Factory.sol
    // This needs to come from your Hardhat artifacts
    const factoryBytecode = '0x608060405234801561001057600080fd5b50610300806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c806301ffc9a7146100465780634a97c90014610079578063d69d1b1c146100d6575b600080fd5b6100636004803603602081101561005c57600080fd5b50356100f3565b604080519115158252519081900360200190f35b6100d46004803603606081101561008f57600080fd5b8101906020810135600160201b8111156100a857600080fd5b8201836020820111156100ba57600080fd5b803590602001918460018302840111600160201b831117156100db57600080fd5b5050929550919350505050505b005b6100de610113565b604080516001600160a01b039092168252519081900360200190f35b60015b92915050565b6040805160208101909152600081525b90565b6001600160a01b03169056fea264697066735822122000000000000000000000000000000000000000000000000000000000000000064736f6c63430008140033';

    console.log('[v0] Creating contract factory...');
    const contractFactory = new ethers.ContractFactory(factoryAbi, factoryBytecode, wallet);

    console.log('[v0] Deploying contract with gas settings...');
    const deployTx = await contractFactory.deploy({
      gasLimit: 3000000,
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
