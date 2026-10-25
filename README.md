<p align="center">
  <img src="./logo.png" alt="TraceBOT Logo" width="140" />
</p>

# TraceBOT — Transaction and Wallet Investigator

> Decentralized on-chain forensics and transaction flow tracing engine designed for the Bohr Network (Chain ID: 968).

📄 **[Read Technical Whitepaper](./WHITEPAPER.md)**

---

## Overview

Unlike token distribution trackers (e.g. HolderLens), **TraceBOT** analyzes the temporal sequence of transactions, fund pathways, and relationships between addresses on Bohr Network. It empowers users, security researchers, and developers to understand what happened on-chain during complex, failed, or suspicious transactions.

### Key Capabilities

1. **Transaction Forensics & Revert Analysis**:
   - Status diagnosis (Success vs Reverted).
   - Exact EVM execution revert reasons and failure descriptions.
   - Gas consumption vs gas limit profiling and effective execution cost in native BOT.
   - Input payload and 4-byte method signature decoding.

2. **Visual Fund & Asset Flow**:
   - Step-by-step sequential visual path of native BOT transfers and smart contract interactions.
   - ERC-20 `Transfer(address,address,uint256)` event extraction and token volume movement tracking.

3. **Wallet Activity Dossier**:
   - Real-time balance and lifetime transaction nonces.
   - Detection of smart contract bytecode vs Externally Owned Accounts (EOAs).
   - Frequency analysis of counterparty interactions (identifying routers, frequent targets, and pools).
   - Heuristic anomaly signals (elevated revert ratios, low gas reserves for high-volume accounts, unindexed activity).

4. **On-Chain Audit Registry (`TraceBOTRegistry.sol`)**:
   - Every investigation request or re-check is formally recorded on Bohr Testnet.
   - **Payment Model**: Gas only (zero protocol fees).
   - Cryptographic result hash attestation: Anchors report findings with a tamper-proof digital fingerprint on-chain.

---

## Bohr Testnet Configuration

| Parameter | Value |
|---|---|
| **Network Name** | Bohr Testnet |
| **Chain ID** | `968` |
| **RPC Endpoint** | `https://rpc.bohr.life` |
| **Native Currency** | `BOT` (18 decimals) |
| **Block Explorer** | [https://scan.bohr.life](https://scan.bohr.life) |
| **Deployed Contract** | `0x358d360A6b59b4d45CC96A012A083f6196CA9d45` |

---

## Smart Contract Architecture

The registry contract is located at [`contracts/contracts/TraceBOTRegistry.sol`](./contracts/contracts/TraceBOTRegistry.sol):

- `requestTrace(bytes32 transactionHash)`: Initiates on-chain transaction trace (Gas only).
- `requestWalletTrace(address targetWallet, uint8 scope)`: Initiates wallet investigation with scope 1 (Recent), 2 (Standard), or 3 (Deep).
- `checkTrace(bytes32 targetKey)`: State-changing inquiry that logs re-verification and updates global audit counters.
- `recordResultHash(bytes32 targetKey, bytes32 resultHash)`: Seals report integrity immutably on-chain.
- `getRecentTraces(uint256 limit)`: Fetches recent global investigation logs directly from EVM storage.

---

## Getting Started

### 1. Environment Configuration

Check [`.env.local`](./.env.local):

```bash
PRIVATE_KEY=your_private_key_here
PROJECT_ID=d9690df1851903b53a4f8c440127edec
RPC_URL=https://rpc.bohr.life
CHAIN_ID=968
EXPLORER_URL=https://scan.bohr.life
CONTRACT_ADDRESS=0x358d360A6b59b4d45CC96A012A083f6196CA9d45
```

### 2. Smart Contract Commands

```bash
cd contracts
npm install
npx hardhat test
npx hardhat run scripts/deploy.js --network bohr
```

### 3. Frontend Web Application

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
