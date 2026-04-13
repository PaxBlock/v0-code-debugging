const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Deploy Factory first
  const Factory = await hre.ethers.getContractFactory("UniversityFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✓ UniversityFactory deployed to:", factoryAddress);

  // Save addresses for later use
  const fs = require("fs");
  const deploymentAddresses = {
    factory: factoryAddress,
    network: hre.network.name,
    deploymentDate: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployment-addresses.json",
    JSON.stringify(deploymentAddresses, null, 2)
  );

  console.log("\n📋 Deployment complete!");
  console.log("Factory Address:", factoryAddress);
  console.log("\nNext steps:");
  console.log("1. Save the Factory address above");
  console.log("2. Universities can now be deployed via the factory");
  console.log("3. Addresses saved to deployment-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
