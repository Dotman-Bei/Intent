// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ApprovalGate
/// @notice Human-in-the-loop threshold logic. Anything at or below a user's auto-approve
///         threshold executes straight away; anything above it must be signed for by the user
///         (`approveIntent`) before the vault will let the agent execute it.
contract ApprovalGate {
    struct UserConfig {
        uint256 autoApproveThreshold; // in token base units, 0 = always require approval
        bool enabled;
    }

    /// @notice How long a user's approval of a specific intent stays valid.
    uint256 public constant APPROVAL_TTL = 30 minutes;

    mapping(address => UserConfig) public userConfigs;
    /// @dev user => intentHash => unix timestamp the approval was granted at (0 = never).
    mapping(address => mapping(bytes32 => uint256)) public approvedAt;

    event ConfigUpdated(address indexed user, uint256 threshold);
    event ApprovalRequested(address indexed user, bytes32 indexed intentHash, uint256 amount);
    event IntentApproved(address indexed user, bytes32 indexed intentHash, uint256 expiresAt);
    event IntentApprovalRevoked(address indexed user, bytes32 indexed intentHash);

    /// @notice Opt in and set the ceiling under which the agent may act without a second signature.
    function setConfig(uint256 _threshold) external {
        userConfigs[msg.sender] = UserConfig({autoApproveThreshold: _threshold, enabled: true});
        emit ConfigUpdated(msg.sender, _threshold);
    }

    /// @notice Default posture is "ask me": an unconfigured user requires approval for everything.
    function requiresApproval(address _user, uint256 _amount) public view returns (bool) {
        UserConfig memory config = userConfigs[_user];
        if (!config.enabled) return true;
        if (config.autoApproveThreshold == 0) return true;
        return _amount > config.autoApproveThreshold;
    }

    /// @notice Signed by the user from their own wallet — this is the human in the loop.
    function approveIntent(bytes32 _intentHash) external {
        approvedAt[msg.sender][_intentHash] = block.timestamp;
        emit IntentApproved(msg.sender, _intentHash, block.timestamp + APPROVAL_TTL);
    }

    function revokeIntent(bytes32 _intentHash) external {
        delete approvedAt[msg.sender][_intentHash];
        emit IntentApprovalRevoked(msg.sender, _intentHash);
    }

    function isIntentApproved(address _user, bytes32 _intentHash) public view returns (bool) {
        uint256 at = approvedAt[_user][_intentHash];
        return at != 0 && block.timestamp <= at + APPROVAL_TTL;
    }

    /// @notice True when the vault is allowed to execute right now: either the amount is under
    ///         the user's threshold, or the user has explicitly approved this exact intent.
    function canExecute(
        address _user,
        bytes32 _intentHash,
        uint256 _amount
    ) external view returns (bool) {
        if (!requiresApproval(_user, _amount)) return true;
        return isIntentApproved(_user, _intentHash);
    }

    /// @notice Emits an audit trail entry for an intent the agent wants to run.
    function recordIntent(
        address _user,
        bytes32 _intentHash,
        uint256 _amount
    ) external returns (bool needsApproval) {
        needsApproval = requiresApproval(_user, _amount) && !isIntentApproved(_user, _intentHash);
        if (needsApproval) {
            emit ApprovalRequested(_user, _intentHash, _amount);
        }
    }
}
