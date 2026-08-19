// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StrategyRegistry
/// @notice Whitelist + metadata for every protocol IntentFlow is allowed to route into.
///         The AI agent may only ever propose a strategy that lives in here and is active,
///         which is what keeps a natural-language intent from reaching an arbitrary address.
contract StrategyRegistry {
    struct Strategy {
        address protocol;
        string name;
        string protocolType; // "DEX" | "Lending" | "Staking"
        uint256 riskScore; // 1-10, 1 = lowest
        uint256 baseApyBps; // advertised APY in basis points, 850 = 8.50%
        bool active;
    }

    mapping(uint256 => Strategy) private _strategies;
    uint256 public strategyCount;
    address public owner;

    event StrategyAdded(uint256 indexed id, address protocol, string name);
    event StrategyUpdated(uint256 indexed id, bool active);
    event ApyUpdated(uint256 indexed id, uint256 baseApyBps);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error UnknownStrategy(uint256 id);
    error InvalidRisk(uint256 riskScore);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function addStrategy(
        address _protocol,
        string calldata _name,
        string calldata _protocolType,
        uint256 _riskScore,
        uint256 _baseApyBps
    ) external onlyOwner returns (uint256 id) {
        if (_protocol == address(0)) revert ZeroAddress();
        if (_riskScore == 0 || _riskScore > 10) revert InvalidRisk(_riskScore);

        id = strategyCount++;
        _strategies[id] = Strategy({
            protocol: _protocol,
            name: _name,
            protocolType: _protocolType,
            riskScore: _riskScore,
            baseApyBps: _baseApyBps,
            active: true
        });
        emit StrategyAdded(id, _protocol, _name);
    }

    function setStrategyActive(uint256 _id, bool _active) external onlyOwner {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        _strategies[_id].active = _active;
        emit StrategyUpdated(_id, _active);
    }

    function setBaseApy(uint256 _id, uint256 _baseApyBps) external onlyOwner {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        _strategies[_id].baseApyBps = _baseApyBps;
        emit ApyUpdated(_id, _baseApyBps);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    /// @dev A struct-returning getter is required because the compiler-generated getter for a
    ///      public mapping flattens the struct into a tuple, which other contracts cannot
    ///      consume as `Strategy memory`.
    function getStrategy(uint256 _id) public view returns (Strategy memory) {
        if (_id >= strategyCount) revert UnknownStrategy(_id);
        return _strategies[_id];
    }

    function isActive(uint256 _id) external view returns (bool) {
        return _id < strategyCount && _strategies[_id].active;
    }

    /// @notice Active strategies plus their ids, so off-chain callers keep the id that
    ///         `IntentVault.executeIntent` expects.
    function getActiveStrategies()
        external
        view
        returns (uint256[] memory ids, Strategy[] memory list)
    {
        uint256 activeCount;
        for (uint256 i = 0; i < strategyCount; i++) {
            if (_strategies[i].active) activeCount++;
        }

        ids = new uint256[](activeCount);
        list = new Strategy[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < strategyCount; i++) {
            if (_strategies[i].active) {
                ids[idx] = i;
                list[idx] = _strategies[i];
                idx++;
            }
        }
    }
}
