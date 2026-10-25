"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { isAddress, isHex } from "viem";
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink,
  History,
  Lock,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  FileText,
  Activity,
  Layers,
  Database,
  Eye,
} from "lucide-react";
import contractArtifact from "@/contracts/TraceBOTRegistry.json";
import {
  investigateTransaction,
  investigateWallet,
  TxInvestigationResult,
  WalletInvestigationResult,
} from "@/services/inspector";

const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ||
  (contractArtifact.address as `0x${string}`);

export default function TraceBotApp() {
  const { open } = useAppKit();
  const { address: userAddress, isConnected } = useAccount();

  // Search state
  const [activeTab, setActiveTab] = useState<"tx" | "wallet">("tx");
  const [inputQuery, setInputQuery] = useState("");
  const [scope, setScope] = useState<number>(1); // 1 = Recent, 2 = Standard, 3 = Deep

  // Execution & inspection state
  const [isInspecting, setIsInspecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<TxInvestigationResult | null>(null);
  const [walletResult, setWalletResult] = useState<WalletInvestigationResult | null>(null);
  const [onChainTxHash, setOnChainTxHash] = useState<`0x${string}` | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Wagmi contract writing
  const { data: writeHash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isTxWaiting, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: writeHash,
  });

  // Read recent investigations from contract
  const { data: recentTracesData, refetch: refetchRecentTraces } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractArtifact.abi,
    functionName: "getRecentTraces",
    args: [BigInt(6)],
  });

  // Read total stats from contract
  const { data: totalInvestigations } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractArtifact.abi,
    functionName: "totalInvestigations",
  });

  const { data: totalChecks } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractArtifact.abi,
    functionName: "totalChecks",
  });

  // When on-chain transaction confirms, proceed to execute the forensic inspection
  useEffect(() => {
    if (isTxSuccess && writeHash) {
      setOnChainTxHash(writeHash);
      refetchRecentTraces();
      executeInspection(inputQuery.trim(), activeTab, scope);
    }
  }, [isTxSuccess, writeHash]);

  // Handle errors
  useEffect(() => {
    if (writeError) {
      setErrorMsg(writeError.message || "Failed to submit on-chain request");
      setIsInspecting(false);
      setPendingAction(null);
    }
  }, [writeError]);

  const executeInspection = async (
    query: string,
    mode: "tx" | "wallet",
    analysisScope: number
  ) => {
    setIsInspecting(true);
    setErrorMsg(null);

    try {
      if (mode === "tx") {
        const res = await investigateTransaction(query as `0x${string}`);
        setTxResult(res);
        setWalletResult(null);
      } else {
        const res = await investigateWallet(query as `0x${string}`, analysisScope);
        setWalletResult(res);
        setTxResult(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Forensic inspection failed");
    } finally {
      setIsInspecting(false);
      setPendingAction(null);
    }
  };

  // Start Investigation (Submits request to smart contract: Gas only)
  const handleStartInvestigation = async () => {
    const query = inputQuery.trim();
    setErrorMsg(null);

    if (!query) {
      setErrorMsg("Please enter a transaction hash or wallet address");
      return;
    }

    if (activeTab === "tx") {
      if (!query.startsWith("0x") || query.length !== 66) {
        setErrorMsg("Invalid transaction hash. Must be 66 characters starting with 0x");
        return;
      }
    } else {
      if (!isAddress(query)) {
        setErrorMsg("Invalid wallet address. Must be a valid 42-character 0x address");
        return;
      }
    }

    if (!isConnected) {
      open();
      return;
    }

    setPendingAction("investigate");

    try {
      if (activeTab === "tx") {
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: contractArtifact.abi,
          functionName: "requestTrace",
          args: [query as `0x${string}`],
        });
      } else {
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: contractArtifact.abi,
          functionName: "requestWalletTrace",
          args: [query as `0x${string}`, scope],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit request");
      setPendingAction(null);
    }
  };

  // Check Existing Investigation (State-changing function: Gas only)
  const handleCheckExisting = async () => {
    const query = inputQuery.trim();
    setErrorMsg(null);

    if (!query) {
      setErrorMsg("Please enter an identifier to re-check");
      return;
    }

    if (!isConnected) {
      open();
      return;
    }

    setPendingAction("check");

    try {
      let targetKey: `0x${string}`;
      if (activeTab === "tx") {
        targetKey = query as `0x${string}`;
      } else {
        // Compute key matching contract: keccak256(abi.encodePacked(targetWallet, scope))
        targetKey = query as `0x${string}`;
      }

      writeContract({
        address: CONTRACT_ADDRESS,
        abi: contractArtifact.abi,
        functionName: "checkTrace",
        args: [targetKey],
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify trace record");
      setPendingAction(null);
    }
  };

  // Attest / Seal Report Integrity on-chain
  const handleSealReport = async () => {
    if (!isConnected) {
      open();
      return;
    }

    const currentResultHash = txResult?.resultHash || walletResult?.resultHash;
    if (!currentResultHash) return;

    const targetKey =
      activeTab === "tx"
        ? (inputQuery.trim() as `0x${string}`)
        : (walletResult?.resultHash as `0x${string}`);

    setPendingAction("seal");

    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: contractArtifact.abi,
        functionName: "recordResultHash",
        args: [targetKey, currentResultHash],
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to seal report");
      setPendingAction(null);
    }
  };

  // Helper to load sample query
  const loadQuickQuery = (query: string, tab: "tx" | "wallet") => {
    setActiveTab(tab);
    setInputQuery(query);
    executeInspection(query, tab, scope);
  };

  return (
    <div>
      {/* Top Navigation */}
      <header className="navbar">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            <img
              src="/logo.png"
              alt="TraceBOT Logo"
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain" }}
            />
            <span>TraceBOT</span>
            <span className="brand-badge">Bohr Network</span>
          </Link>

          <div className="nav-actions">
            <Link href="/whitepaper" className="btn btn-outline btn-sm">
              <FileText size={14} />
              <span>Whitepaper</span>
            </Link>

            <div className="network-pill">
              <span className="network-dot"></span>
              <span>Bohr Testnet (968)</span>
            </div>

            <button
              onClick={() => open()}
              className={`btn ${isConnected ? "btn-outline" : "btn-primary"}`}
            >
              {isConnected
                ? `${userAddress?.slice(0, 6)}...${userAddress?.slice(-4)}`
                : "Connect Wallet"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container">
        {/* Hero Section */}
        <section className="hero">
          <h1>Transaction & Wallet Investigator</h1>
          <p>
            Trace sequence of transactions, inspect revert reasons, uncover counterparty relationships,
            and log immutable forensic reports on Bohr Testnet.
          </p>
        </section>

        {/* Global Contract Stats Bar */}
        <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-box">
            <div className="stat-label">Total Investigations</div>
            <div className="stat-value">
              {totalInvestigations ? totalInvestigations.toString() : "0"}
            </div>
            <div className="stat-sub">Logged on TraceBOTRegistry</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Total Audit Checks</div>
            <div className="stat-value">
              {totalChecks ? totalChecks.toString() : "0"}
            </div>
            <div className="stat-sub">Re-verification interactions</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Fee Model</div>
            <div className="stat-value" style={{ color: "#2563eb" }}>
              Gas Only
            </div>
            <div className="stat-sub">Zero protocol fee</div>
          </div>
        </div>

        {/* Search & Investigation Bar */}
        <div className="search-card">
          <div className="tab-selector">
            <button
              onClick={() => {
                setActiveTab("tx");
                setErrorMsg(null);
              }}
              className={`tab-btn ${activeTab === "tx" ? "active" : ""}`}
            >
              Transaction Investigation
            </button>
            <button
              onClick={() => {
                setActiveTab("wallet");
                setErrorMsg(null);
              }}
              className={`tab-btn ${activeTab === "wallet" ? "active" : ""}`}
            >
              Wallet Activity Analysis
            </button>
          </div>

          <div className="search-input-group">
            <input
              type="text"
              className="search-input"
              placeholder={
                activeTab === "tx"
                  ? "Enter transaction hash (0x...)"
                  : "Enter wallet address (0x...)"
              }
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
            />

            <button
              onClick={handleStartInvestigation}
              disabled={isWritePending || isTxWaiting || isInspecting}
              className="btn btn-primary"
            >
              {isWritePending || isTxWaiting || isInspecting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Investigate</span>
                </>
              )}
            </button>

            <button
              onClick={handleCheckExisting}
              disabled={isWritePending || isTxWaiting || isInspecting}
              className="btn btn-outline"
              title="State-changing verification of existing report"
            >
              <FileCheck size={16} />
              <span>Check Existing</span>
            </button>
          </div>

          <div className="search-meta">
            {activeTab === "wallet" ? (
              <div className="scope-options">
                <span style={{ fontWeight: 600 }}>Inspection Scope:</span>
                <button
                  onClick={() => setScope(1)}
                  className={`scope-btn ${scope === 1 ? "active" : ""}`}
                >
                  Recent (25)
                </button>
                <button
                  onClick={() => setScope(2)}
                  className={`scope-btn ${scope === 2 ? "active" : ""}`}
                >
                  Standard (50)
                </button>
                <button
                  onClick={() => setScope(3)}
                  className={`scope-btn ${scope === 3 ? "active" : ""}`}
                >
                  Deep (100)
                </button>
              </div>
            ) : (
              <span>Requires confirmation transaction (Gas only) to log request on-chain.</span>
            )}

            <span>
              Contract:{" "}
              <a
                href={`https://scan.bohr.life/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
              </a>
            </span>
          </div>

          {errorMsg && (
            <div className="callout callout-revert" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} />
                <strong>Notice:</strong>
              </div>
              <div style={{ marginTop: "4px" }}>{errorMsg}</div>
            </div>
          )}

          {onChainTxHash && (
            <div className="callout callout-info" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={16} color="#2563eb" />
                <strong>On-Chain Confirmation:</strong>
              </div>
              <div style={{ marginTop: "4px" }}>
                Request recorded on Bohr Testnet:{" "}
                <a
                  href={`https://scan.bohr.life/tx/${onChainTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontFamily: "monospace" }}
                >
                  {onChainTxHash} <ExternalLink size={12} style={{ display: "inline" }} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* =========================================
            TRANSACTION INVESTIGATION REPORT
        ========================================= */}
        {txResult && (
          <div>
            {/* Status & Overview Banner */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Activity size={20} color="#2563eb" />
                  <span>Transaction Overview</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span
                    className={`badge ${
                      txResult.status === "success" ? "badge-success" : "badge-revert"
                    }`}
                  >
                    {txResult.status === "success" ? (
                      <>
                        <CheckCircle2 size={14} /> Success
                      </>
                    ) : (
                      <>
                        <XCircle size={14} /> Reverted
                      </>
                    )}
                  </span>

                  <a
                    href={`https://scan.bohr.life/tx/${txResult.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <span>View on BohrScan</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* If Reverted, Show Prominent Failure Breakdown */}
              {txResult.status === "reverted" && (
                <div className="callout callout-revert">
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                    Execution Revert Reason Detected
                  </div>
                  <div>{txResult.revertReason || "Transaction reverted by EVM bytecode instructions."}</div>
                  <div style={{ fontSize: "0.75rem", marginTop: "6px", color: "#991b1b" }}>
                    State changes were halted and no balances were transferred (gas fee was consumed).
                  </div>
                </div>
              )}

              {/* Summary Metrics */}
              <div className="grid-4" style={{ marginBottom: "1.25rem" }}>
                <div className="stat-box">
                  <div className="stat-label">Value Transferred</div>
                  <div className="stat-value">{txResult.value} BOT</div>
                  <div className="stat-sub">Native currency</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Method Called</div>
                  <div className="stat-value" style={{ fontSize: "0.95rem" }}>
                    {txResult.methodName}
                  </div>
                  <div className="stat-sub">
                    {txResult.isContractCall ? "Contract Execution" : "Direct Transfer"}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Gas Consumed</div>
                  <div className="stat-value">{Number(txResult.gasUsed).toLocaleString()}</div>
                  <div className="stat-sub">Limit: {Number(txResult.gasLimit).toLocaleString()}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Block Number</div>
                  <div className="stat-value">
                    {txResult.blockNumber ? txResult.blockNumber.toString() : "Pending"}
                  </div>
                  <div className="stat-sub">
                    {txResult.timestamp
                      ? new Date(txResult.timestamp * 1000).toLocaleTimeString()
                      : "Unconfirmed"}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <table className="info-table">
                <tbody>
                  <tr>
                    <th>Transaction Hash</th>
                    <td>{txResult.hash}</td>
                  </tr>
                  <tr>
                    <th>From (Initiator)</th>
                    <td>
                      <a
                        href={`https://scan.bohr.life/address/${txResult.from}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {txResult.from}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <th>To (Recipient / Contract)</th>
                    <td>
                      {txResult.to ? (
                        <a
                          href={`https://scan.bohr.life/address/${txResult.to}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {txResult.to}
                        </a>
                      ) : (
                        <span style={{ color: "#d97706" }}>[Contract Creation Deployment]</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Nonce</th>
                    <td>{txResult.nonce}</td>
                  </tr>
                  <tr>
                    <th>Input Data Payload</th>
                    <td style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {txResult.inputData.length > 80
                        ? `${txResult.inputData.slice(0, 80)}... (${txResult.inputData.length} chars)`
                        : txResult.inputData}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Visual Transaction Flow Path */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Layers size={20} color="#2563eb" />
                  <span>Visual Transaction Flow Path</span>
                </div>
                <span className="badge badge-info">{txResult.flowSteps.length} Step(s)</span>
              </div>

              <div className="flow-container">
                {txResult.flowSteps.map((step) => (
                  <div key={step.step} className="flow-step">
                    <div className="flow-step-num">{step.step}</div>
                    <div className="flow-step-content">
                      <div className="flow-step-title">{step.title}</div>
                      <div className="flow-step-desc">{step.description}</div>
                      <div className="flow-addresses">
                        <span>{step.from.slice(0, 8)}...{step.from.slice(-6)}</span>
                        <ArrowRight size={14} color="#94a3b8" />
                        <span>{step.to.slice(0, 8)}...{step.to.slice(-6)}</span>
                        {step.amount && (
                          <span style={{ marginLeft: "auto", fontWeight: 700, color: "#2563eb" }}>
                            {step.amount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Token Transfers */}
            {txResult.tokenTransfers.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Database size={20} color="#2563eb" />
                    <span>ERC-20 Token Transfers</span>
                  </div>
                  <span className="badge badge-info">
                    {txResult.tokenTransfers.length} Event(s)
                  </span>
                </div>

                <table className="info-table">
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th>Token Contract</th>
                      <th>Sender</th>
                      <th>Recipient</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txResult.tokenTransfers.map((t, idx) => (
                      <tr key={idx}>
                        <td>
                          <a
                            href={`https://scan.bohr.life/token/${t.tokenAddress}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t.tokenAddress.slice(0, 8)}...{t.tokenAddress.slice(-6)}
                          </a>
                        </td>
                        <td>{t.from.slice(0, 8)}...{t.from.slice(-6)}</td>
                        <td>{t.to.slice(0, 8)}...{t.to.slice(-6)}</td>
                        <td style={{ fontWeight: 700 }}>{t.formattedAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cryptographic Report Attestation */}
            <div className="card" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <div className="card-header" style={{ borderColor: "#bbf7d0" }}>
                <div className="card-title" style={{ color: "#166534" }}>
                  <Lock size={20} color="#166534" />
                  <span>Report Integrity Hash</span>
                </div>
                <button
                  onClick={handleSealReport}
                  disabled={isWritePending || isTxWaiting}
                  className="btn btn-outline btn-sm"
                  style={{ background: "#ffffff", borderColor: "#86efac" }}
                >
                  <FileCheck size={14} />
                  <span>Attest On-Chain</span>
                </button>
              </div>

              <p style={{ fontSize: "0.85rem", color: "#166534", marginBottom: "0.5rem" }}>
                This cryptographic fingerprint uniquely attests this investigation report. It can be stored
                on TraceBOTRegistry to guarantee non-repudiation and report tampering resistance.
              </p>
              <div
                style={{
                  fontFamily: "monospace",
                  background: "#ffffff",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  border: "1px solid #86efac",
                  wordBreak: "break-all",
                }}
              >
                {txResult.resultHash}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            WALLET INVESTIGATION REPORT
        ========================================= */}
        {walletResult && (
          <div>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Activity size={20} color="#2563eb" />
                  <span>Wallet Activity Dossier</span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span className="badge badge-info">
                    {walletResult.isContract ? "Smart Contract" : "EOA Wallet"}
                  </span>
                  <a
                    href={`https://scan.bohr.life/address/${walletResult.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <span>View on BohrScan</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Wallet Core Stats */}
              <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
                <div className="stat-box">
                  <div className="stat-label">BOT Balance</div>
                  <div className="stat-value">{Number(walletResult.balanceBOT).toFixed(4)} BOT</div>
                  <div className="stat-sub">Native reserves</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Transaction Count (Nonce)</div>
                  <div className="stat-value">{walletResult.txCount}</div>
                  <div className="stat-sub">Lifetime outbound nonces</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Analysis Scope</div>
                  <div className="stat-value">Level {walletResult.scope}</div>
                  <div className="stat-sub">Depth of examined transfers</div>
                </div>
              </div>

              <table className="info-table">
                <tbody>
                  <tr>
                    <th>Address</th>
                    <td>{walletResult.address}</td>
                  </tr>
                  <tr>
                    <th>Bytecode Type</th>
                    <td>
                      {walletResult.isContract
                        ? "Deployed Smart Contract Bytecode"
                        : "Externally Owned Account (Private Key controlled)"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Suspicious Signals & Risk Indicators */}
            {walletResult.suspiciousSignals.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <AlertTriangle size={20} color="#d97706" />
                    <span>Forensic & Anomaly Signals</span>
                  </div>
                  <span className="badge badge-warning">
                    {walletResult.suspiciousSignals.length} Flag(s)
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {walletResult.suspiciousSignals.map((sig, idx) => (
                    <div
                      key={idx}
                      className={
                        sig.severity === "high"
                          ? "callout callout-revert"
                          : sig.severity === "medium"
                          ? "callout callout-warning"
                          : "callout callout-info"
                      }
                      style={{ marginBottom: 0 }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: "2px" }}>{sig.title}</div>
                      <div>{sig.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Repeated Contract Interactions */}
            {walletResult.repeatedContracts.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Layers size={20} color="#2563eb" />
                    <span>Repeated Contract Counterparties</span>
                  </div>
                  <span className="badge badge-info">
                    {walletResult.repeatedContracts.length} Destination(s)
                  </span>
                </div>

                <table className="info-table">
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th>Contract Address</th>
                      <th>Interactions</th>
                      <th>Relationship</th>
                      <th>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletResult.repeatedContracts.map((c, idx) => (
                      <tr key={idx}>
                        <td>{c.contractAddress}</td>
                        <td style={{ fontWeight: 700 }}>{c.interactionCount} calls</td>
                        <td>
                          <span className="badge badge-info">{c.label}</span>
                        </td>
                        <td>
                          <a
                            href={`https://scan.bohr.life/address/${c.contractAddress}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Inspect <ExternalLink size={12} style={{ display: "inline" }} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cryptographic Report Attestation */}
            <div className="card" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <div className="card-header" style={{ borderColor: "#bbf7d0" }}>
                <div className="card-title" style={{ color: "#166534" }}>
                  <Lock size={20} color="#166534" />
                  <span>Dossier Integrity Hash</span>
                </div>
                <button
                  onClick={handleSealReport}
                  disabled={isWritePending || isTxWaiting}
                  className="btn btn-outline btn-sm"
                  style={{ background: "#ffffff", borderColor: "#86efac" }}
                >
                  <FileCheck size={14} />
                  <span>Attest On-Chain</span>
                </button>
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  background: "#ffffff",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  border: "1px solid #86efac",
                  wordBreak: "break-all",
                }}
              >
                {walletResult.resultHash}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            RECENT ON-CHAIN INVESTIGATIONS LOG
        ========================================= */}
        <div className="card" style={{ marginTop: "2rem" }}>
          <div className="card-header">
            <div className="card-title">
              <History size={20} color="#2563eb" />
              <span>Recent TraceBOT On-Chain Registrations</span>
            </div>
            <button
              onClick={() => refetchRecentTraces()}
              className="btn btn-outline btn-sm"
              title="Refresh from Bohr blockchain"
            >
              <RefreshCw size={12} />
              <span>Refresh</span>
            </button>
          </div>

          {Array.isArray(recentTracesData) && recentTracesData.length > 0 ? (
            <table className="info-table">
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th>Target Type</th>
                  <th>Target Identifier</th>
                  <th>Requester</th>
                  <th>Checks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentTracesData.map((trace: any, idx: number) => {
                  const isTx = trace.targetType === 0;
                  const displayId = isTx
                    ? trace.originalTxHash
                    : trace.targetWallet;
                  return (
                    <tr key={idx}>
                      <td>
                        <span className={`badge ${isTx ? "badge-info" : "badge-warning"}`}>
                          {isTx ? "Transaction" : "Wallet"}
                        </span>
                      </td>
                      <td>
                        {displayId
                          ? `${displayId.slice(0, 10)}...${displayId.slice(-8)}`
                          : "Custom Target"}
                      </td>
                      <td>
                        {trace.requester
                          ? `${trace.requester.slice(0, 6)}...${trace.requester.slice(-4)}`
                          : "Anonymous"}
                      </td>
                      <td>{trace.checkCount ? trace.checkCount.toString() : "1"}</td>
                      <td>
                        <button
                          onClick={() => loadQuickQuery(displayId, isTx ? "tx" : "wallet")}
                          className="btn btn-outline btn-sm"
                        >
                          <Eye size={12} />
                          <span>Load Report</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem 0", color: "#94a3b8" }}>
              No previous investigation requests found yet on Bohr Testnet. Start the first one above!
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          TraceBOT — Decentralized Forensic Investigator for Bohr Network (Chain ID: 968) • Gas
          Only Model • Deployed at {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}
        </div>
      </footer>
    </div>
  );
}
