const fs = require('fs');
const path = require('path');

// Direct deployment using ethers.js
async function deployWithEthers() {
  try {
    // Import ethers dynamically
    const ethers = await import('ethers');
    
    console.log('[v0] Initializing deployment...');
    
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    if (!RPC_URL || !PRIVATE_KEY) {
      throw new Error('Missing environment variables: SEPOLIA_RPC_URL or PRIVATE_KEY');
    }

    // Connect to network
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('[v0] Connected to Sepolia');
    console.log('[v0] Deployer address:', signer.address);

    // Get balance
    const balance = await provider.getBalance(signer.address);
    const balanceEth = ethers.formatEther(balance);
    console.log('[v0] Account balance:', balanceEth, 'ETH');

    if (parseFloat(balanceEth) === 0) {
      throw new Error('Insufficient balance. Get Sepolia ETH from faucet');
    }

    // Read Factory contract ABI and bytecode
    console.log('[v0] Reading Factory contract artifact...');
    
    const factoryPath = path.join(__dirname, '../artifacts/contracts/Factory.sol/UniversityFactory.json');
    
    if (!fs.existsSync(factoryPath)) {
      throw new Error(`Factory artifact not found at ${factoryPath}. Run 'npx hardhat compile' first.`);
    }

    const factoryArtifact = JSON.parse(fs.readFileSync(factoryPath, 'utf8'));
    
    // Create contract factory
    const ContractFactory = new ethers.ContractFactory(
      factoryArtifact.abi,
      factoryArtifact.bytecode,
      signer
    );

    console.log('[v0] Deploying UniversityFactory contract...');
    
    // Deploy
    const contract = await ContractFactory.deploy();
    console.log('[v0] Transaction sent:', contract.deploymentTransaction().hash);
    console.log('[v0] Waiting for confirmation...');

    const deployedContract = await contract.waitForDeployment();
    const contractAddress = await deployedContract.getAddress();

    console.log('\n=== DEPLOYMENT SUCCESSFUL ===');
    console.log('[v0] Factory Contract Address:', contractAddress);
    console.log('[v0] Network: Sepolia');
    console.log('==============================\n');

    // Save deployment info
    const deploymentData = {
      factoryAddress: contractAddress,
      network: 'sepolia',
      chainId: 11155111,
      deploymentDate: new Date().toISOString(),
      rpcUrl: RPC_URL,
    };

    fs.writeFileSync(
      path.join(__dirname, '../deployment-addresses.json'),
      JSON.stringify(deploymentData, null, 2)
    );

    console.log('[v0] Deployment info saved to deployment-addresses.json');
    console.log('[v0] You can now use this address in your UI!\n');

    return contractAddress;

  } catch (error) {
    console.error('[v0] Deployment error:', error.message);
    throw error;
  }
}

// Run deployment
deployWithEthers()
  .then(() => {
    console.log('[v0] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[v0] Fatal error:', error);
    process.exit(1);
  });
