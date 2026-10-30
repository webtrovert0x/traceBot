# TraceBOT Technical Whitepaper
### Decentralized On-Chain Forensics & Transaction Graph Tracing for BOT Chain

---

## 1. Executive Summary

As decentralized applications on the **BOT Chain** proliferate, transaction complexity increases exponentially. Decentralized finance (DeFi) protocols, smart routers, automated market makers (AMMs), and multi-hop token transfers create intricate state transitions. When a transaction reverts, transfers assets unexpectedly, or interacts with deceptive contracts, standard block explorers offer only raw hexadecimal payloads and generic failure flags.

**TraceBOT** introduces a specialized forensics and transaction-flow tracing framework on the BOT Chain (Chain ID: 677). It decomposes complex EVM executions into human-readable sequence graphs, extracts exact revert reasons, maps counterparty contract relationships, and logs an immutable, state-verified investigation record onto the blockchain.

---

## 2. Problem Statement

1. **Opaque EVM Revert Failures**: When a user dispatches a transaction on an EVM chain that reverts, the EVM rolls back state changes while consuming gas. Users are frequently left without actionable insights into whether the revert was triggered by insufficient slippage, transfer restrictions, missing approvals, or malicious trap logic.
2. **Hidden Asset Routes**: Multi-step operations (e.g. flash loans, internal transfers, DEX aggregators) produce nested execution paths where the final recipient of funds is obscured by intermediary router contracts.
3. **Absence of Proof-of-Investigation**: Users seeking audit trail verification or dispute resolution lack a standardized, tamper-evident mechanism to record that an investigation was performed at a specific block height.

---

## 3. The TraceBOT Architecture

TraceBOT operates a dual-layer architecture consisting of the on-chain registry (`TraceBOTRegistry.sol`) and the client-side forensic indexing engine.

```
                      +-----------------------------+
                      |   TraceBOT User Interface   |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
    [1. Gas-Only Request]                         [2. Deep Analysis]
               |                                           |
               v                                           v
+-------------------------------+             +---------------------------+
|     TraceBOTRegistry.sol      |             |   BOT Chain JSON-RPC Node |
| (BOT Chain: 0xE7c3...0E3d9)   |             |  (https://rpc.botchain.ai)|
+-------------------------------+             +-------------+-------------+
               |                                            |
               |                               +------------+------------+
               |                               |                         |
               |                        [Raw Receipt & Logs]    [EVM Call Replay]
               |                               |                         |
               |                               +------------+------------+
               |                                            |
               v                                            v
+-------------------------------+             +---------------------------+
|  On-Chain Audit Trail & Seals | <---------  |    Forensic Visualizer    |
|  - Total Investigations       |  Integrity  |    - Revert Reason        |
|  - Cryptographic Result Hash  |  Attestation|    - BOT & Token Flows    |
|  - Check Counter              |             |    - Counterparty Map     |
+-------------------------------+             +---------------------------+
```

### 3.1 TraceBOTRegistry.sol

The core smart contract deployed on BOT Chain maintains an immutable ledger of forensic investigations:

* **`requestTrace(bytes32 transactionHash)`**: Records an investigation request for a target transaction hash. Increments the global investigation counter and emits `TraceRequested`.
* **`requestWalletTrace(address targetWallet, uint8 scope)`**: Records an investigation inquiry for a wallet address across configurable analytical depth scopes:
  * `Scope 1 (Recent)`: Examines the most recent 25 transactions and immediate counterparties.
  * `Scope 2 (Standard)`: Deepens analysis to 50 transactions and identifies recurring router contracts.
  * `Scope 3 (Deep)`: Full historical sweep (up to 100 transactions) evaluating revert frequency and balance velocity.
* **`checkTrace(bytes32 targetKey)`**: A state-changing verification function that records each time an investigation is accessed or re-audited, incrementing `checkCount` and timestamping the access.
* **`recordResultHash(bytes32 targetKey, bytes32 resultHash)`**: Commits a cryptographic hash ($H = \text{keccak256}(\text{dossier})$) to the contract, locking the investigation findings against retrospective alteration.

---

## 4. Economic Model: Pure Gas Only

Existing Web3 forensic suites impose expensive subscriptions or high pay-per-query protocol fees. TraceBOT adopts a **Pure Gas Only** model:

$$\text{Protocol Fee} = 0 \quad \implies \quad \text{User Cost} = \text{Gas Used} \times \text{Gas Price}$$

1. **Zero Protocol Fees**: The smart contract does not take any cut or levy any token fees.
2. **Predictable Execution**: Verification requests require small execution gas, enabling developers and researchers to integrate TraceBOT without financial friction.

---

## 5. Network Specifications

| Parameter | Specification |
|---|---|
| **Network Name** | BOT Chain |
| **Chain ID** | `677` |
| **RPC Endpoint** | `https://rpc.botchain.ai` |
| **Native Token** | `BOT` (18 decimals) |
| **Explorer** | [https://scan.botchain.ai](https://scan.botchain.ai) |
| **Official Website** | [https://botchain.ai](https://botchain.ai) |
| **Registry Contract** | `0xE7c3D3109eA0a77870b7AA7a8B7d91fD0970E3d9` |

---

## 6. Security & Auditability

All on-chain trace registrations and integrity hashes are publicly verifiable on BOT Chain Explorer:
[https://scan.botchain.ai/address/0xE7c3D3109eA0a77870b7AA7a8B7d91fD0970E3d9#code](https://scan.botchain.ai/address/0xE7c3D3109eA0a77870b7AA7a8B7d91fD0970E3d9#code)
