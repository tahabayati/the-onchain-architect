// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ArchitectRegistry
 * @notice An immutable, append-only registry that anchors 3D architectural
 *         blueprints (stored on Filecoin/IPFS via Lighthouse) to the chain.
 * @dev WHAT: Maps each architect wallet to the list of blueprints it uploaded.
 *      WHY: Storing the CID together with the SHA-256 hash and a block
 *      timestamp gives a tamper-evident proof of authorship and existence.
 *      FILECOIN: Intended for deployment on the Filecoin EVM (FEVM). The CID
 *      points to the file on Filecoin storage; this contract is the on-chain
 *      source of truth. There are no admin keys, no upgrades, and no deletion.
 */
contract ArchitectRegistry {
    /**
     * @notice A single anchored architectural blueprint.
     * @param architect The wallet that anchored the blueprint.
     * @param fileCID The IPFS CID returned by Lighthouse for the stored file.
     * @param fileHash The SHA-256 hash of the original file, for integrity checks.
     * @param timestamp The block timestamp at which the blueprint was anchored.
     */
    struct Blueprint {
        address architect;
        string fileCID;
        string fileHash;
        uint256 timestamp;
    }

    /// @notice All blueprints anchored by each architect, in upload order.
    mapping(address => Blueprint[]) private blueprintsByArchitect;

    /// @dev Thrown when attempting to anchor a blueprint with an empty CID string.
    error EmptyCID();

    /// @dev Thrown when attempting to anchor a blueprint with an empty hash string.
    error EmptyHash();

    /// @dev Thrown when requesting a blueprint index that does not exist.
    error IndexOutOfBounds();

    /**
     * @notice Emitted whenever a blueprint is anchored.
     * @param architect The wallet that anchored the blueprint.
     * @param fileCID The IPFS CID of the stored file.
     * @param fileHash The SHA-256 hash of the stored file.
     * @param timestamp The block timestamp of the anchoring.
     */
    event BlueprintAnchored(
        address indexed architect,
        string fileCID,
        string fileHash,
        uint256 timestamp
    );

    /**
     * @notice Anchors a new blueprint to the caller's address.
     * @dev Records are append-only; they can never be edited or removed.
     * @param _fileCID The IPFS CID of the blueprint returned by Lighthouse.
     * @param _fileHash The SHA-256 hash of the blueprint file.
     */
    function anchorBlueprint(
        string memory _fileCID,
        string memory _fileHash
    ) external {
        if (bytes(_fileCID).length == 0) revert EmptyCID();
        if (bytes(_fileHash).length == 0) revert EmptyHash();

        blueprintsByArchitect[msg.sender].push(
            Blueprint({
                architect: msg.sender,
                fileCID: _fileCID,
                fileHash: _fileHash,
                timestamp: block.timestamp
            })
        );

        emit BlueprintAnchored(msg.sender, _fileCID, _fileHash, block.timestamp);
    }

    /**
     * @notice Returns the total number of blueprints anchored by a given architect.
     * @param _architect The wallet address to query.
     * @return The count of blueprints anchored by this address.
     */
    function getBlueprintCount(
        address _architect
    ) external view returns (uint256) {
        return blueprintsByArchitect[_architect].length;
    }

    /**
     * @notice Returns a single blueprint at a specific index for an architect.
     * @dev Provides gas-efficient paginated access to avoid high-memory RPC queries.
     * @param _architect The wallet address to query.
     * @param _index The zero-based index of the blueprint.
     * @return The Blueprint struct at the specified index.
     */
    function getBlueprint(
        address _architect,
        uint256 _index
    ) external view returns (Blueprint memory) {
        if (_index >= blueprintsByArchitect[_architect].length) {
            revert IndexOutOfBounds();
        }
        return blueprintsByArchitect[_architect][_index];
    }

    /**
     * @notice Returns every blueprint anchored by a given architect.
     * @param _architect The wallet address to look up.
     * @return An array of Blueprint structs in upload order (empty if none).
     */
    function getArchitectBlueprints(
        address _architect
    ) external view returns (Blueprint[] memory) {
        return blueprintsByArchitect[_architect];
    }
}
