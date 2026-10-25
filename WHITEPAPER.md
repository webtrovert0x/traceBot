# TraceBOT Technical Whitepaper
### Decentralized On-Chain Forensics & Transaction Graph Tracing for Bohr Network

---

## 1. Executive Summary

As decentralized applications on the **Bohr Network** proliferate, transaction complexity increases exponentially. Decentralized finance (DeFi) protocols, smart routers, automated market makers (AMMs), and multi-hop token transfers create intricate state transitions. When a transaction reverts, transfers assets unexpectedly, or interacts with deceptive contracts, standard block explorers offer only raw hexadecimal payloads and generic failure flags.

**TraceBOT** introduces a specialized forensics and transaction-flow tracing framework on the Bohr Network (Chain ID: 968). It decomposes complex EVM executions into human-readable sequence graphs, extracts exact revert reasons, maps counterparty contract relationships, and logs an immutable, state-verified investigation record onto the blockchain.

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
|     TraceBOTRegistry.sol      |             |     Bohr JSON-RPC Node    |
| (Bohr Testnet: 0x358d...9d45) |             |    (https://rpc.bohr.life)|
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

The core smart contract deployed on Bohr Testnet maintains an immutable ledger of forensic investigations:

* **`requestTrace(bytes32 transactionHash)`**: Records an investigation request for a target transaction hash. Increments the global investigation counter and emits `TraceRequested`.
* **`requestWalletTrace(address targetWallet, uint8 scope)`**: Records an investigation inquiry for a wallet address across configurable analytical depth scopes:
  * `Scope 1 (Recent)`: Examines the most recent 25 transactions and immediate counterparties.
  * `Scope 2 (Standard)`: Deepens analysis to 50 transactions and identifies recurring router contracts.
  * `Scope 3 (Deep)`: Full historical sweep (up to 100 transactions) evaluating revert frequency and balance velocity.
* **`checkTrace(bytes32 targetKey)`**: A state-changing verification function that records each time an investigation is accessed or re-audited, incrementing `checkCount` and timestamping the access.
* **`recordResultHash(bytes32 targetKey, bytes32 resultHash)`**: Commits a cryptographic hash ($H = \text{keccak256}(\text{dossier})$) to the contract, locking the investigation findings against retrospective alteration.

---

## 4. Economic Model: Gas Only

Unlike centralized analytics platforms that mandate subscription tiers or paywalled token gates, TraceBOT utilizes a **pure gas-only model**:

$$\text{User Cost} = \text{Gas Used} \times \text{Gas Price}$$

* **Zero Protocol Tax**: The `TraceBOTRegistry` contract charges 0 BOT in protocol fees.
* **Censorship-Resistant Inquiries**: Anyone with enough BOT to cover standard EVM execution gas can initiate, re-verify, or seal an investigation.
* **Spam Deterrence**: Because every investigation request and check is an EVM state-changing call, network gas mechanics naturally prevent denial-of-service spam while keeping logs decentralized.

---

## 5. Forensic Diagnostics Engine

### 5.1 Revert Reason Extraction
When a transaction status evaluates to `0x0` (reverted), the forensics engine automatically attempts an `eth_call` simulation with matching execution parameters (`from`, `to`, `data`, `value`, `gas`). This surfaces EVM revert reason strings (e.g. `ERC20: transfer amount exceeds balance`, `Pancake: INSUFFICIENT_OUTPUT_AMOUNT`) or custom Solidity panic codes.

### 5.2 Flow Graph Generation
Every transaction receipt is parsed for:
1. Native BOT value transfers.
2. Standard ERC-20 `Transfer(address,address,uint256)` topic logs (`0xddf252...`).
3. Contract creations (`tx.to == null` with newly deployed bytecode).
4. Method selector mapping against a verified database of EVM 4-byte interfaces.

The resulting data is assembled into an ordered sequence:
$$\text{Path} = [(\text{Step}_1, A \xrightarrow{v_1} B), (\text{Step}_2, B \xrightarrow{\text{call}} C), \dots, (\text{Step}_k, \text{Event}_k)]$$

---

## 6. Security Considerations & Non-Repudiation

1. **Storage Minimization**: The smart contract does not duplicate transaction byte streams already present in the Bohr chain. Instead, it maintains index keys and cryptographic seals, preserving low gas overhead.
2. **Deterministic Attestation**: By computing $\text{keccak256}$ of the standardized JSON dossier and anchoring it via `recordResultHash()`, investigators can later present the report to any third party who can verify that the hash matches the on-chain record at block timestamp $T$.

---

## 7. Conclusion

TraceBOT bridges the critical gap between raw EVM execution data and actionable on-chain intelligence on the Bohr Network. By pairing decentralized state logging with an automated forensics inspection pipeline, it establishes a transparent standard for transaction and wallet investigations.
