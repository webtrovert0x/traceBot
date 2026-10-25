const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==========================================");
  console.log(" Deploying TraceBOTRegistry to Bohr Network");
  console.log("==========================================");

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer found. Please check PRIVATE_KEY in .env");
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} BOT`);

  const TraceBOTRegistry = await hre.ethers.getContractFactory("TraceBOTRegistry");
  console.log("\nDeploying TraceBOTRegistry...");
  const registry = await TraceBOTRegistry.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();
  console.log(`\n🎉 TraceBOTRegistry deployed successfully at: ${contractAddress}`);

  // Save deployed address into root and contracts .env files
  const rootEnvPath = path.resolve(__dirname, "../../.env.local");
  const contractsEnvPath = path.resolve(__dirname, "../.env");

  function updateEnvFile(filePath, address) {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, "utf8");
      if (content.includes("CONTRACT_ADDRESS=")) {
        content = content.replace(/CONTRACT_ADDRESS=.*(\r?\n|$)/g, `CONTRACT_ADDRESS=${address}$1`);
      } else {
        content += `\nCONTRACT_ADDRESS=${address}\n`;
      }
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Updated CONTRACT_ADDRESS in ${filePath}`);
    }
  }

  updateEnvFile(rootEnvPath, contractAddress);
  updateEnvFile(contractsEnvPath, contractAddress);

  // Write deployment info json
  const deploymentInfo = {
    network: "bohr",
    chainId: 968,
    contractAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentDir, "bohr.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment complete!");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
