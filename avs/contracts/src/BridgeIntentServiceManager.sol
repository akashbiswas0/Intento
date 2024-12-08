// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@eigenlayer/contracts/interfaces/IServiceManager.sol";
import {ECDSAServiceManagerBase} from "@eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {ECDSAStakeRegistry} from "@eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";
import {ECDSAUpgradeable} from "@openzeppelin-upgrades/contracts/utils/cryptography/ECDSAUpgradeable.sol";
import {IERC1271Upgradeable} from "@openzeppelin-upgrades/contracts/interfaces/IERC1271Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct Intent {
    address user;
    address sourceToken;
    uint256 sourceAmount;
    uint256 destinationChainId;
    address destinationToken;
    uint256 destinationAmount; //destinationAmount is amount that user will receive on destination chain. destinationAmount = sourceAmount - fillerFee 
    uint256 fillerFee; // fee that filler will receive for filling the order
    uint32 createdBlock;
    bool isCompleted;
}

contract BridgeIntentServiceManager is ECDSAServiceManagerBase {
    using ECDSAUpgradeable for bytes32;
    uint32 public latestIntentId;
    mapping(uint32 => bytes32) public allIntentHashes;
    mapping(uint32 => Intent) public intents;
    mapping(address => mapping(uint32 => bytes)) public intentResponses;
    
    event NewIntentCreated(uint32 indexed intentId, Intent intent);
    event IntentCompleted(uint32 indexed intentId, bytes32 proof);

    constructor(
        address _avsDirectory,
        address _stakeRegistry,
        address _rewardsCoordinator,
        address _delegationManager
    ) ECDSAServiceManagerBase(
        _avsDirectory,
        _stakeRegistry,
        _rewardsCoordinator,
        _delegationManager
    ) {}

    function createIntent(
        address sourceToken,
        uint256 sourceAmount,
        uint256 destinationChainId,
        address destinationToken,
        uint256 destinationAmount,
        uint256 fillerFee
    ) external returns (Intent memory) {
        Intent memory newIntent;
        newIntent.user = msg.sender;
        newIntent.sourceToken = sourceToken;
        newIntent.sourceAmount = sourceAmount;
        newIntent.destinationChainId = destinationChainId;
        newIntent.destinationToken = destinationToken;
        newIntent.destinationAmount = destinationAmount;
        newIntent.fillerFee = fillerFee;
        newIntent.createdBlock = uint32(block.number);
        newIntent.isCompleted = false;

        // Transfer tokens from user to contract
        IERC20(sourceToken).transferFrom(msg.sender, address(this), sourceAmount);

        allIntentHashes[latestIntentId] = keccak256(abi.encode(newIntent));
        intents[latestIntentId] = newIntent;
        
        emit NewIntentCreated(latestIntentId, newIntent);
        latestIntentId++;

        return newIntent;
    }

    function completeIntent(
        uint32 intentId,
        bytes32 fillTransactionHash,
        address filler,
        bytes memory signature
    ) external {
        Intent storage intent = intents[intentId];
        require(!intent.isCompleted, "Intent already completed");
        
        // Verify operator signature
        bytes32 messageHash = keccak256(abi.encodePacked(intentId, fillTransactionHash));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        
        require(
            ECDSAStakeRegistry(stakeRegistry).operatorRegistered(signer),
            "Invalid operator signature"
        );

        // Transfer tokens to relayer
        intent.isCompleted = true;
        IERC20(intent.sourceToken).transfer(filler, intent.sourceAmount); // filler will receive sourceAmount as he is the one who filled the intent on destination chain
        
        emit IntentCompleted(intentId, fillTransactionHash);
    }
} 