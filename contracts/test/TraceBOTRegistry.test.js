const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TraceBOTRegistry", function () {
  let registry;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const TraceBOTRegistry = await ethers.getContractFactory("TraceBOTRegistry");
    registry = await TraceBOTRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("should record a transaction trace request with gas only", async function () {
    const fakeTxHash = ethers.keccak256(ethers.toUtf8Bytes("test_transaction_123"));

    const tx = await registry.connect(addr1).requestTrace(fakeTxHash);
    const receipt = await tx.wait();

    expect(receipt.status).to.equal(1);
    expect(await registry.totalInvestigations()).to.equal(1);
    expect(await registry.totalChecks()).to.equal(1);

    const record = await registry.getTrace(fakeTxHash);
    expect(record.originalTxHash).to.equal(fakeTxHash);
    expect(record.requester).to.equal(addr1.address);
    expect(record.checkCount).to.equal(1);
    expect(record.isReportSealed).to.be.false;
  });

  it("should record a wallet trace request with specified scope", async function () {
    const scope = 2; // Standard
    const expectedKey = ethers.solidityPackedKeccak256(
      ["address", "uint8"],
      [addr2.address, scope]
    );

    const tx = await registry.connect(addr1).requestWalletTrace(addr2.address, scope);
    await tx.wait();

    expect(await registry.totalInvestigations()).to.equal(1);
    const record = await registry.getTrace(expectedKey);
    expect(record.targetWallet).to.equal(addr2.address);
    expect(record.scope).to.equal(scope);
    expect(record.requester).to.equal(addr1.address);
  });

  it("should support checkTrace as a state-changing re-verification function", async function () {
    const fakeTxHash = ethers.keccak256(ethers.toUtf8Bytes("investigation_456"));
    await registry.connect(addr1).requestTrace(fakeTxHash);

    // Now addr2 checks existing trace
    const checkTx = await registry.connect(addr2).checkTrace(fakeTxHash);
    await checkTx.wait();

    expect(await registry.totalChecks()).to.equal(2);
    const record = await registry.getTrace(fakeTxHash);
    expect(record.checkCount).to.equal(2);
  });

  it("should record and verify result integrity hash", async function () {
    const fakeTxHash = ethers.keccak256(ethers.toUtf8Bytes("investigation_789"));
    await registry.connect(addr1).requestTrace(fakeTxHash);

    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("report_contents_sha256"));
    await registry.connect(addr1).recordResultHash(fakeTxHash, reportHash);

    const record = await registry.getTrace(fakeTxHash);
    expect(record.isReportSealed).to.be.true;
    expect(record.resultHash).to.equal(reportHash);
  });

  it("should return paginated user traces and recent traces", async function () {
    const tx1 = ethers.keccak256(ethers.toUtf8Bytes("tx1"));
    const tx2 = ethers.keccak256(ethers.toUtf8Bytes("tx2"));

    await registry.connect(addr1).requestTrace(tx1);
    await registry.connect(addr1).requestTrace(tx2);

    expect(await registry.getUserTraceCount(addr1.address)).to.equal(2);
    const userTraces = await registry.getUserTraces(addr1.address, 0, 10);
    expect(userTraces.length).to.equal(2);

    const recent = await registry.getRecentTraces(5);
    expect(recent.length).to.equal(2);
    // Newest first
    expect(recent[0].originalTxHash).to.equal(tx2);
  });
});
