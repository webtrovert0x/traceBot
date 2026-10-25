// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TraceBOTRegistry
 * @notice On-chain investigation registry for TraceBOT — Transaction and Wallet Investigator on Bohr Network.
 * @dev Records forensic investigation requests and integrity verification hashes for transactions and wallets.
 *      Payment model: Gas only for every investigation or existing-report check.
 */
contract TraceBOTRegistry {
    enum TargetType {
        TRANSACTION,
        WALLET
    }

    struct TraceRecord {
        bytes32 targetKey;       // Target lookup key: txHash for TX, keccak256(wallet, scope) for WALLET
        TargetType targetType;   // TRANSACTION (0) or WALLET (1)
        address requester;       // Address that initiated the investigation
        bytes32 originalTxHash;  // Raw transaction hash (if targetType == TRANSACTION)
        address targetWallet;    // Target wallet address (if targetType == WALLET)
        uint8 scope;             // Investigation scope (1 = Recent, 2 = Standard, 3 = Deep)
        uint256 requestedAt;     // Timestamp when request was submitted
        bytes32 resultHash;      // Cryptographic hash / IPFS CID hash of the investigation findings
        uint256 checkCount;      // Total number of times checkTrace has been called
        uint256 lastCheckedAt;   // Timestamp of the latest checkTrace invocation
        bool isReportSealed;     // Whether the report integrity hash has been pinned
    }

    // Target lookup key => TraceRecord
    mapping(bytes32 => TraceRecord) private _traces;

    // Ordered list of all recorded target keys
    bytes32[] private _allTargetKeys;

    // User address => array of target keys initiated by the user
    mapping(address => bytes32[]) private _userTargetKeys;

    // Global counters
    uint256 public totalInvestigations;
    uint256 public totalChecks;

    // Events
    event TraceRequested(
        uint256 indexed requestId,
        bytes32 indexed targetKey,
        address indexed requester,
        bytes32 txHash,
        uint256 timestamp
    );

    event WalletTraceRequested(
        uint256 indexed requestId,
        bytes32 indexed targetKey,
        address indexed requester,
        address targetWallet,
        uint8 scope,
        uint256 timestamp
    );

    event TraceChecked(
        bytes32 indexed targetKey,
        address indexed checker,
        uint256 newCheckCount,
        bytes32 resultHash,
        uint256 timestamp
    );

    event ResultHashRecorded(
        bytes32 indexed targetKey,
        bytes32 resultHash,
        address indexed updatedBy,
        uint256 timestamp
    );

    /**
     * @notice Records an investigation request for a specific transaction hash.
     * @dev User pays gas only. Emits TraceRequested.
     * @param transactionHash The bytes32 hash of the transaction to investigate.
     * @return targetKey The unique bytes32 key representing this investigation (equals transactionHash).
     */
    function requestTrace(bytes32 transactionHash) external returns (bytes32 targetKey) {
        require(transactionHash != bytes32(0), "TraceBOTRegistry: Invalid transaction hash");
        targetKey = transactionHash;

        TraceRecord storage record = _traces[targetKey];
        bool isNew = (record.requestedAt == 0);

        if (isNew) {
            record.targetKey = targetKey;
            record.targetType = TargetType.TRANSACTION;
            record.requester = msg.sender;
            record.originalTxHash = transactionHash;
            record.scope = 1;
            record.requestedAt = block.timestamp;
            record.lastCheckedAt = block.timestamp;
            record.checkCount = 1;

            _allTargetKeys.push(targetKey);
            _userTargetKeys[msg.sender].push(targetKey);
            totalInvestigations += 1;
        } else {
            record.checkCount += 1;
            record.lastCheckedAt = block.timestamp;
        }

        totalChecks += 1;

        emit TraceRequested(
            totalInvestigations,
            targetKey,
            msg.sender,
            transactionHash,
            block.timestamp
        );

        return targetKey;
    }

    /**
     * @notice Records a wallet investigation request with specified analysis scope.
     * @dev User pays gas only. Emits WalletTraceRequested.
     * @param targetWallet The address of the wallet to inspect.
     * @param scope Analysis scope: 1 (Recent - 25 txs), 2 (Standard - 50 txs), 3 (Deep - 100 txs).
     * @return targetKey The deterministic key keccak256(abi.encodePacked(targetWallet, scope)).
     */
    function requestWalletTrace(address targetWallet, uint8 scope)
        external
        returns (bytes32 targetKey)
    {
        require(targetWallet != address(0), "TraceBOTRegistry: Invalid wallet address");
        require(scope >= 1 && scope <= 3, "TraceBOTRegistry: Scope must be between 1 and 3");

        targetKey = keccak256(abi.encodePacked(targetWallet, scope));

        TraceRecord storage record = _traces[targetKey];
        bool isNew = (record.requestedAt == 0);

        if (isNew) {
            record.targetKey = targetKey;
            record.targetType = TargetType.WALLET;
            record.requester = msg.sender;
            record.targetWallet = targetWallet;
            record.scope = scope;
            record.requestedAt = block.timestamp;
            record.lastCheckedAt = block.timestamp;
            record.checkCount = 1;

            _allTargetKeys.push(targetKey);
            _userTargetKeys[msg.sender].push(targetKey);
            totalInvestigations += 1;
        } else {
            record.checkCount += 1;
            record.lastCheckedAt = block.timestamp;
        }

        totalChecks += 1;

        emit WalletTraceRequested(
            totalInvestigations,
            targetKey,
            msg.sender,
            targetWallet,
            scope,
            block.timestamp
        );

        return targetKey;
    }

    /**
     * @notice Re-checks / verifies an existing investigation.
     * @dev State-changing function requiring gas. Updates check counter and logs check event.
     * @param targetKey The target identifier (tx hash or wallet trace key).
     * @return exists True if the investigation has been recorded.
     * @return resultHash The recorded integrity hash (if any).
     */
    function checkTrace(bytes32 targetKey)
        external
        returns (bool exists, bytes32 resultHash)
    {
        require(targetKey != bytes32(0), "TraceBOTRegistry: Invalid target key");
        TraceRecord storage record = _traces[targetKey];

        exists = (record.requestedAt > 0);
        if (exists) {
            record.checkCount += 1;
            record.lastCheckedAt = block.timestamp;
            resultHash = record.resultHash;
        } else {
            // Even if not yet formally indexed, record access attempt
            record.targetKey = targetKey;
            record.requester = msg.sender;
            record.requestedAt = block.timestamp;
            record.lastCheckedAt = block.timestamp;
            record.checkCount = 1;

            _allTargetKeys.push(targetKey);
            _userTargetKeys[msg.sender].push(targetKey);
            totalInvestigations += 1;
            resultHash = bytes32(0);
        }

        totalChecks += 1;

        emit TraceChecked(
            targetKey,
            msg.sender,
            record.checkCount,
            resultHash,
            block.timestamp
        );

        return (exists, resultHash);
    }

    /**
     * @notice Stores a cryptographic result hash on-chain so the report can be verified for integrity.
     * @param targetKey The target key of the investigation.
     * @param resultHash Cryptographic hash of the report findings (e.g. keccak256 or IPFS CID digest).
     */
    function recordResultHash(bytes32 targetKey, bytes32 resultHash) external {
        require(targetKey != bytes32(0), "TraceBOTRegistry: Invalid target key");
        require(resultHash != bytes32(0), "TraceBOTRegistry: Invalid result hash");

        TraceRecord storage record = _traces[targetKey];
        if (record.requestedAt == 0) {
            record.targetKey = targetKey;
            record.requester = msg.sender;
            record.requestedAt = block.timestamp;
            record.checkCount = 1;
            _allTargetKeys.push(targetKey);
            _userTargetKeys[msg.sender].push(targetKey);
            totalInvestigations += 1;
        }

        record.resultHash = resultHash;
        record.isReportSealed = true;
        record.lastCheckedAt = block.timestamp;

        emit ResultHashRecorded(targetKey, resultHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Returns complete details of a specific investigation.
     * @param targetKey Target identifier.
     */
    function getTrace(bytes32 targetKey) external view returns (TraceRecord memory) {
        return _traces[targetKey];
    }

    /**
     * @notice Returns total count of investigation requests initiated by a user.
     * @param user The address of the user.
     */
    function getUserTraceCount(address user) external view returns (uint256) {
        return _userTargetKeys[user].length;
    }

    /**
     * @notice Returns paginated trace records initiated by a user.
     * @param user The address of the user.
     * @param offset Starting index.
     * @param limit Max items to return.
     */
    function getUserTraces(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (TraceRecord[] memory) {
        bytes32[] storage keys = _userTargetKeys[user];
        uint256 total = keys.length;

        if (offset >= total) {
            return new TraceRecord[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        TraceRecord[] memory result = new TraceRecord[](size);

        for (uint256 i = 0; i < size; i++) {
            result[i] = _traces[keys[offset + i]];
        }

        return result;
    }

    /**
     * @notice Returns the latest global investigation records.
     * @param limit Max items to return (up to 50).
     */
    function getRecentTraces(uint256 limit)
        external
        view
        returns (TraceRecord[] memory)
    {
        uint256 total = _allTargetKeys.length;
        if (total == 0) {
            return new TraceRecord[](0);
        }

        if (limit > 50) {
            limit = 50;
        }

        uint256 count = limit > total ? total : limit;
        TraceRecord[] memory result = new TraceRecord[](count);

        for (uint256 i = 0; i < count; i++) {
            // Return newest first
            bytes32 key = _allTargetKeys[total - 1 - i];
            result[i] = _traces[key];
        }

        return result;
    }

    /**
     * @notice Returns the total number of registered investigations.
     */
    function getTotalInvestigations() external view returns (uint256) {
        return totalInvestigations;
    }
}
