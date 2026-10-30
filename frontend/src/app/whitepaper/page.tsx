"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, FileText, Lock, Database, Activity, GitCommit } from "lucide-react";

export default function WhitepaperPage() {
  return (
    <div>
      {/* Header */}
      <header className="navbar">
        <div className="container nav-inner">
          <Link href="/" className="brand">
            <img
              src="/logo.png"
              alt="TraceBOT Logo"
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain" }}
            />
            <span>TraceBOT</span>
            <span className="brand-badge">Whitepaper</span>
          </Link>

          <div className="nav-actions">
            <Link href="/" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} />
              <span>Back to App</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="container" style={{ maxWidth: 880, padding: "3rem 1.5rem" }}>
        <div className="card" style={{ padding: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <FileText size={32} color="#2563eb" />
            <div>
              <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0f172a" }}>
                TraceBOT Technical Whitepaper
              </h1>
              <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
                Decentralized On-Chain Forensics & Transaction Graph Tracing for BOT Chain
              </p>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "1.5rem 0" }} />

          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
              1. Executive Summary
            </h2>
            <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: "0.75rem" }}>
              As decentralized applications on the <strong>BOT Chain</strong> expand, transaction flows become
              intricately layered. Automated market makers, cross-contract router calls, and token distribution
              mechanisms obscure the exact path of funds. When transactions fail or funds migrate unexpectedly,
              traditional block explorers only offer raw hex byte dumps.
            </p>
            <p style={{ color: "#334155", lineHeight: 1.7 }}>
              <strong>TraceBOT</strong> bridges this diagnostic divide. It operates an automated on-chain forensics
              investigator on BOT Chain (Chain ID: 677) that replays executions, diagnoses exact EVM revert
              messages, builds chronological fund sequence graphs, and anchors reports via cryptographic hash seals.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
              2. Core Problems Solved
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="callout callout-info" style={{ marginBottom: 0 }}>
                <strong>Opaque EVM Revert Failures:</strong> Users pay gas for reverted transactions without
                knowing why. TraceBOT replays the execution against local EVM state to uncover the revert string.
              </div>
              <div className="callout callout-info" style={{ marginBottom: 0 }}>
                <strong>Multi-Hop Token Routing:</strong> Internal calls often hide intermediate contract hops.
                TraceBOT extracts native BOT and ERC-20 Transfer logs to present a sequential visual path.
              </div>
              <div className="callout callout-info" style={{ marginBottom: 0 }}>
                <strong>Non-Repudiation:</strong> Investigations need audit proof. TraceBOT records requests and
                tamper-evident result hashes directly on BOT Chain.
              </div>
            </div>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
              3. Smart Contract Architecture (TraceBOTRegistry.sol)
            </h2>
            <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: "1rem" }}>
              The registry contract is deployed at{" "}
              <a
                href="https://scan.botchain.ai/address/0xE7c3D3109eA0a77870b7AA7a8B7d91fD0970E3d9"
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: "monospace", fontWeight: 600 }}
              >
                0xE7c3D3109eA0a77870b7AA7a8B7d91fD0970E3d9
              </a>
              . Key interfaces include:
            </p>
            <table className="info-table">
              <tbody>
                <tr>
                  <th>requestTrace(bytes32 txHash)</th>
                  <td>Logs investigation for a transaction on-chain. Gas only.</td>
                </tr>
                <tr>
                  <th>requestWalletTrace(address, uint8)</th>
                  <td>Initiates multi-scope wallet counterparty investigation.</td>
                </tr>
                <tr>
                  <th>checkTrace(bytes32 targetKey)</th>
                  <td>State-changing verification call updating check counter.</td>
                </tr>
                <tr>
                  <th>recordResultHash(bytes32, bytes32)</th>
                  <td>Immutably pins report digest hash for tamper-proof audit trail.</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
              4. Pure Gas-Only Economic Model
            </h2>
            <p style={{ color: "#334155", lineHeight: 1.7 }}>
              Unlike paywalled Web3 audit suites, TraceBOT operates with <strong>0% protocol tax</strong>. Every
              on-chain investigation request requires standard BOT Chain gas only:
            </p>
            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "6px",
                fontFamily: "monospace",
                textAlign: "center",
                margin: "1rem 0",
                border: "1px solid #e2e8f0",
              }}
            >
              Cost = GasUsed × GasPrice (0 Protocol Fee)
            </div>
          </section>

          <section style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.75rem" }}>
              5. Network Parameters
            </h2>
            <table className="info-table">
              <tbody>
                <tr>
                  <th>Network</th>
                  <td>BOT Chain</td>
                </tr>
                <tr>
                  <th>Chain ID</th>
                  <td>677</td>
                </tr>
                <tr>
                  <th>RPC Endpoint</th>
                  <td>https://rpc.botchain.ai</td>
                </tr>
                <tr>
                  <th>Native Token</th>
                  <td>BOT (18 decimals)</td>
                </tr>
                <tr>
                  <th>Block Explorer</th>
                  <td>
                    <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
                      https://scan.botchain.ai
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
