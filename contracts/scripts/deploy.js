const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  console.log("==========================================");
  console.log(` Deploying TraceBOTRegistry to ${networkName.toUpperCase()} Network`);
  console.log("==========================================");

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer found. Please check PRIVATE_KEY in .env");
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} BOT`);

  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || 20000000000n;
  console.log(`Gas Price: ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`);

  const TraceBOTRegistry = await hre.ethers.getContractFactory("TraceBOTRegistry");
  console.log("\nDeploying TraceBOTRegistry with minimal gas fee...");
  
  // Explicitly pass gasPrice to avoid overpaying
  const registry = await TraceBOTRegistry.deploy({
    gasPrice: gasPrice,
  });

  console.log(`Transaction submitted: ${registry.deploymentTransaction().hash}`);
  console.log("Waiting for block confirmation...");
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  const deployTx = await registry.deploymentTransaction().getTransaction();
  const receipt = await registry.deploymentTransaction().wait(1);

  console.log(`\n🎉 TraceBOTRegistry deployed successfully!`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Block Number:     ${receipt.blockNumber}`);
  console.log(`Gas Used:         ${receipt.gasUsed.toString()}`);
  console.log(`Effective Gas Fee:${hre.ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || gasPrice))} BOT`);

  // Update root .env.local
  const rootEnvPath = path.resolve(__dirname, "../../.env.local");
  const contractsEnvPath = path.resolve(__dirname, "../.env");
  const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env.local");

  function updateEnvFile(filePath, updates) {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
    }
    fs.writeFileSync(filePath, content.trim() + "\n", "utf8");
    console.log(`Updated environment file: ${filePath}`);
  }

  const envUpdates = {
    CHAIN_ID: networkName === "botchain" ? "677" : "968",
    RPC_URL: networkName === "botchain" ? "https://rpc.botchain.ai" : "https://rpc.bohr.life",
    EXPLORER_URL: networkName === "botchain" ? "https://scan.botchain.ai" : "https://scan.bohr.life",
    CONTRACT_ADDRESS: contractAddress,
    NEXT_PUBLIC_CHAIN_ID: networkName === "botchain" ? "677" : "968",
    NEXT_PUBLIC_RPC_URL: networkName === "botchain" ? "https://rpc.botchain.ai" : "https://rpc.bohr.life",
    NEXT_PUBLIC_EXPLORER_URL: networkName === "botchain" ? "https://scan.botchain.ai" : "https://scan.bohr.life",
    NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress,
  };

  updateEnvFile(rootEnvPath, envUpdates);
  updateEnvFile(contractsEnvPath, envUpdates);
  updateEnvFile(frontendEnvPath, envUpdates);

  // Update frontend contract artifact
  const frontendArtifactPath = path.resolve(
    __dirname,
    "../../frontend/src/contracts/TraceBOTRegistry.json"
  );
  if (fs.existsSync(frontendArtifactPath)) {
    const artifactData = JSON.parse(fs.readFileSync(frontendArtifactPath, "utf8"));
    artifactData.address = contractAddress;
    fs.writeFileSync(frontendArtifactPath, JSON.stringify(artifactData, null, 2), "utf8");
    console.log(`Updated contract address in frontend artifact: ${frontendArtifactPath}`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    chainId: networkName === "botchain" ? 677 : 968,
    contractAddress,
    deployer: deployer.address,
    transactionHash: registry.deploymentTransaction().hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date().toISOString(),
  };

  const deploymentDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  const deploymentFile = path.join(deploymentDir, `${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Saved deployment record to: ${deploymentFile}`);

  console.log("\n==========================================");
  console.log(" Deployment complete!");
  console.log("==========================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
