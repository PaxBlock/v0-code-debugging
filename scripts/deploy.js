const hre = require("hardhat");
const fs = require("fs");

async function main() {
  try {
    console.log("[v0] Starting deployment to Sepolia...");
    console.log("[v0] Network:", hre.network.name);
    console.log("[v0] RPC URL exists:", !!process.env.SEPOLIA_RPC_URL);
    console.log("[v0] Private key exists:", !!process.env.PRIVATE_KEY);

    // Get signer
    const [deployer] = await hre.ethers.getSigners();
    console.log("[v0] Deploying with account:", deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("[v0] Account balance:", hre.ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
      throw new Error("Insufficient balance. Please get Sepolia ETH from a faucet.");
    }

    // Deploy Factory
    console.log("[v0] Compiling contracts...");
    const Factory = await hre.ethers.getContractFactory("UniversityFactory");
    console.log("[v0] Deploying UniversityFactory...");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();

    console.log("[v0] ✓ UniversityFactory deployed to:", factoryAddress);

    // Save deployment addresses
    const deploymentAddresses = {
      factory: factoryAddress,
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      deploymentDate: new Date().toISOString(),
    };

    fs.writeFileSync(
      "deployment-addresses.json",
      JSON.stringify(deploymentAddresses, null, 2)
    );

    console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
    console.log("Factory Address:", factoryAddress);
    console.log("Network: Sepolia");
    console.log("Save this address for the UI!");
    console.log("=============================\n");

    process.exit(0);
  } catch (error) {
    console.error("[v0] Deployment failed:", error.message);
    console.error("[v0] Full error:", error);
    process.exit(1);
  }
}

main();
