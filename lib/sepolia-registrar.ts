import { ethers } from "ethers";

const FACTORY_ADDRESS = "0x34f423528e7eb822ae9c98792d8377207835fde7";
const FACTORY_ABI = [
  "function deployUniversity(string universityName, string symbol, address universityAdmin, string baseMetadataURI) returns (address)",
  "event UniversityDeployed(address indexed contractAddress, string universityName, address indexed universityAdmin)",
];

export async function registerInstitutionOnSepolia(input: { name: string; abbreviation: string; metadataUri: string }) {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl || !privateKey) throw new Error("Sepolia registrar is not configured.");

  const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: 11155111, name: "sepolia" });
  const wallet = new ethers.Wallet(privateKey, provider);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);
  const tx = await factory.deployUniversity(input.name, input.abbreviation, wallet.address, input.metadataUri);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("The Sepolia registration transaction was not confirmed.");

  const event = receipt.logs
    .map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } })
    .find((parsed) => parsed?.name === "UniversityDeployed");

  return {
    transactionHash: receipt.hash,
    contractAddress: event?.args?.contractAddress as string | undefined,
    registrarAddress: wallet.address,
    chainId: 11155111,
  };
}

export { FACTORY_ADDRESS };
