import { createPublicClient, http, formatEther, isAddress, keccak256, toHex, stringToHex } from "viem";
import { botchain } from "@/config/botchain";

export const publicClient = createPublicClient({
  chain: botchain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.botchain.ai"),
});

// Known standard ERC-20 Transfer topic
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Common ERC-20 / DeFi Method Signatures for decoding
const COMMON_SELECTORS: Record<string, string> = {
  "0xa9059cbb": "transfer(address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0xd0e30db0": "deposit()",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
  "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
  "0x18cbafe5": "swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
  "0xfb3bdb41": "swapETHForExactTokens(uint256,address[],address,uint256)",
  "0x89afcb44": "requestTrace(bytes32)",
  "0x3a48e77c": "requestWalletTrace(address,uint8)",
  "0xcf48f654": "checkTrace(bytes32)",
};

export interface TokenTransfer {
  tokenAddress: string;
  from: string;
  to: string;
  rawAmount: string;
  formattedAmount: string;
  symbol: string;
}

export interface TxInvestigationResult {
  hash: string;
  status: "success" | "reverted" | "pending";
  blockNumber: bigint | null;
  timestamp: number | null;
  from: string;
  to: string | null;
  value: string; // in BOT
  gasUsed: string;
  gasPriceGwei: string;
  gasLimit: string;
  nonce: number;
  inputData: string;
  methodName: string;
  isContractCall: boolean;
  isContractCreation: boolean;
  revertReason?: string;
  tokenTransfers: TokenTransfer[];
  logsCount: number;
  flowSteps: Array<{
    step: number;
    title: string;
    description: string;
    from: string;
    to: string;
    type: "native" | "token" | "contract_call" | "revert";
    amount?: string;
  }>;
  resultHash: `0x${string}`;
}

export interface WalletInvestigationResult {
  address: string;
  isContract: boolean;
  balanceBOT: string;
  txCount: number;
  scope: number; // 1, 2, or 3
  recentTransactions: Array<{
    hash: string;
    from: string;
    to: string | null;
    valueBOT: string;
    status: "success" | "reverted";
    timestamp: number;
    method?: string;
  }>;
  repeatedContracts: Array<{
    contractAddress: string;
    interactionCount: number;
    label?: string;
  }>;
  suspiciousSignals: Array<{
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
  }>;
  resultHash: `0x${string}`;
}

/**
 * Investigates a specific transaction hash
 */
export async function investigateTransaction(
  txHash: `0x${string}`
): Promise<TxInvestigationResult> {
  const [tx, receipt] = await Promise.all([
    publicClient.getTransaction({ hash: txHash }),
    publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null),
  ]);

  if (!tx) {
    throw new Error("Transaction not found on BOT Chain network. Check the hash or wait for mining.");
  }

  let timestamp: number | null = null;
  if (tx.blockNumber) {
    try {
      const block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
      timestamp = Number(block.timestamp);
    } catch {
      timestamp = Math.floor(Date.now() / 1000);
    }
  }

  // Check if destination is a contract
  let isContract = false;
  if (tx.to) {
    try {
      const code = await publicClient.getBytecode({ address: tx.to });
      isContract = !!code && code !== "0x";
    } catch {
      isContract = false;
    }
  }

  // Decode method signature
  const selector = tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10).toLowerCase() : null;
  const methodName = selector && COMMON_SELECTORS[selector] ? COMMON_SELECTORS[selector] : selector ? `call(${selector})` : "Native Transfer";

  // Check status & revert reason
  const status: "success" | "reverted" | "pending" = receipt
    ? receipt.status === "success"
      ? "success"
      : "reverted"
    : "pending";

  let revertReason: string | undefined;
  if (status === "reverted") {
    try {
      // Replay transaction via call to extract revert error string
      await publicClient.call({
        account: tx.from,
        to: tx.to ?? undefined,
        data: tx.input,
        value: tx.value,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
      });
    } catch (err: any) {
      revertReason = err?.shortMessage || err?.message || "Execution reverted without reason string";
    }
  }

  // Parse logs for ERC-20 transfers
  const tokenTransfers: TokenTransfer[] = [];
  if (receipt && receipt.logs) {
    for (const log of receipt.logs) {
      if (log.topics[0] === ERC20_TRANSFER_TOPIC && log.topics.length >= 3) {
        try {
          const from = ("0x" + log.topics[1]?.slice(26)) as string;
          const to = ("0x" + log.topics[2]?.slice(26)) as string;
          const rawAmount = BigInt(log.data || "0").toString();
          // Assume standard 18 decimals unless known
          const formatted = (Number(BigInt(log.data || "0")) / 1e18).toFixed(4);

          tokenTransfers.push({
            tokenAddress: log.address,
            from,
            to,
            rawAmount,
            formattedAmount: formatted,
            symbol: "TOKEN",
          });
        } catch {
          // Skip malformed log
        }
      }
    }
  }

  // Build sequential flow steps
  const flowSteps: TxInvestigationResult["flowSteps"] = [];
  let stepIndex = 1;

  // 1. Initial invocation / BOT transfer
  const valBOT = formatEther(tx.value);
  if (Number(valBOT) > 0) {
    flowSteps.push({
      step: stepIndex++,
      title: "Native BOT Transfer",
      description: `Dispatched ${valBOT} BOT from initiator`,
      from: tx.from,
      to: tx.to || "Contract Creation",
      type: "native",
      amount: `${valBOT} BOT`,
    });
  }

  // 2. Contract call if present
  if (isContract && tx.to) {
    flowSteps.push({
      step: stepIndex++,
      title: "Smart Contract Execution",
      description: `Invoked method ${methodName} on target contract`,
      from: tx.from,
      to: tx.to,
      type: "contract_call",
    });
  }

  // 3. Token transfers discovered in logs
  for (const t of tokenTransfers) {
    flowSteps.push({
      step: stepIndex++,
      title: "Token Asset Movement",
      description: `Transferred ${t.formattedAmount} tokens via contract`,
      from: t.from,
      to: t.to,
      type: "token",
      amount: `${t.formattedAmount} (${t.tokenAddress.slice(0, 6)}...${t.tokenAddress.slice(-4)})`,
    });
  }

  // 4. If reverted
  if (status === "reverted") {
    flowSteps.push({
      step: stepIndex++,
      title: "Transaction Revert",
      description: revertReason || "Execution halted and state changes rolled back by EVM",
      from: tx.to || tx.from,
      to: tx.from,
      type: "revert",
    });
  }

  // Compute integrity result hash
  const summaryString = JSON.stringify({
    hash: tx.hash,
    status,
    from: tx.from,
    to: tx.to,
    value: valBOT,
    revertReason: revertReason || null,
    tokenTransfersCount: tokenTransfers.length,
    timestamp,
  });
  const resultHash = keccak256(stringToHex(summaryString));

  return {
    hash: tx.hash,
    status,
    blockNumber: tx.blockNumber,
    timestamp,
    from: tx.from,
    to: tx.to,
    value: valBOT,
    gasUsed: receipt ? receipt.gasUsed.toString() : "0",
    gasPriceGwei: tx.gasPrice ? (Number(tx.gasPrice) / 1e9).toFixed(2) : "0",
    gasLimit: tx.gas.toString(),
    nonce: tx.nonce,
    inputData: tx.input,
    methodName,
    isContractCall: isContract,
    isContractCreation: !tx.to && !!receipt?.contractAddress,
    revertReason,
    tokenTransfers,
    logsCount: receipt?.logs?.length || 0,
    flowSteps,
    resultHash,
  };
}

/**
 * Investigates a wallet address on BOT Chain
 */
export async function investigateWallet(
  walletAddress: `0x${string}`,
  scope: number = 1
): Promise<WalletInvestigationResult> {
  const [balance, txCount, bytecode] = await Promise.all([
    publicClient.getBalance({ address: walletAddress }),
    publicClient.getTransactionCount({ address: walletAddress }),
    publicClient.getBytecode({ address: walletAddress }),
  ]);

  const isContract = !!bytecode && bytecode !== "0x";
  const balanceBOT = formatEther(balance);

  // Fetch recent transactions via BotScan API if available, or fall back to simulated sample
  let recentTransactions: WalletInvestigationResult["recentTransactions"] = [];
  try {
    const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://scan.botchain.ai";
    const explorerApiUrl = `${explorerBase}/api?module=account&action=txlist&address=${walletAddress}&page=1&offset=${scope === 1 ? 15 : scope === 2 ? 30 : 50}&sort=desc`;
    const res = await fetch(explorerApiUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "1" && Array.isArray(data.result)) {
        recentTransactions = data.result.map((item: any) => ({
          hash: item.hash,
          from: item.from,
          to: item.to || null,
          valueBOT: formatEther(BigInt(item.value || "0")),
          status: item.isError === "0" ? "success" : "reverted",
          timestamp: Number(item.timeStamp || Math.floor(Date.now() / 1000)),
          method: item.functionName || item.methodId || undefined,
        }));
      }
    }
  } catch {
    // API not responding or network isolated, proceed with on-chain metrics
  }

  // Calculate repeated contract interactions
  const contractCountMap: Record<string, number> = {};
  for (const t of recentTransactions) {
    if (t.to && t.to.toLowerCase() !== walletAddress.toLowerCase()) {
      contractCountMap[t.to] = (contractCountMap[t.to] || 0) + 1;
    }
  }

  const repeatedContracts = Object.entries(contractCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([contractAddress, count]) => ({
      contractAddress,
      interactionCount: count,
      label: count > 3 ? "Frequent Target" : "Counterparty",
    }));

  // Analyze suspicious signals
  const suspiciousSignals: WalletInvestigationResult["suspiciousSignals"] = [];

  const revertedCount = recentTransactions.filter((tx) => tx.status === "reverted").length;
  if (revertedCount >= 3) {
    suspiciousSignals.push({
      severity: "high",
      title: "Elevated Transaction Revert Rate",
      detail: `${revertedCount} out of the last ${recentTransactions.length} transactions failed or reverted. May indicate honeypot exposure, failed arbitrage, or front-running bot.`,
    });
  }

  if (Number(balanceBOT) < 0.01 && txCount > 50) {
    suspiciousSignals.push({
      severity: "medium",
      title: "Low Gas Reserve for Active Account",
      detail: `Account has executed ${txCount} transactions but currently holds only ${balanceBOT} BOT.`,
    });
  }

  if (isContract) {
    suspiciousSignals.push({
      severity: "low",
      title: "Smart Contract Code Detected",
      detail: "Address is a deployed smart contract bytecode, not a standard Externally Owned Account (EOA).",
    });
  }

  if (recentTransactions.length === 0) {
    suspiciousSignals.push({
      severity: "low",
      title: "No Explorer Indexer Records Found",
      detail: "No indexed public transfer history found on BotScan. Target may be newly funded or dormant.",
    });
  }

  // Result Hash
  const summary = JSON.stringify({
    wallet: walletAddress,
    isContract,
    balanceBOT,
    txCount,
    scope,
    suspiciousCount: suspiciousSignals.length,
    timestamp: Math.floor(Date.now() / 1000),
  });
  const resultHash = keccak256(stringToHex(summary));

  return {
    address: walletAddress,
    isContract,
    balanceBOT,
    txCount,
    scope,
    recentTransactions,
    repeatedContracts,
    suspiciousSignals,
    resultHash,
  };
}
