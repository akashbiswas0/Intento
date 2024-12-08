// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract IntentFiller is ReentrancyGuard {
    // State variables
    uint256 public fillId;
    
    struct FillState {
        bool filled;
        address filler;
        uint256 amount;
        uint256 timestamp;
    }
    
    mapping(bytes32 => FillState) public filledIntents;
    
    event IntentFilled(
        uint32 indexed sourceChainIntentId,
        address indexed filler,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 fillId,
        uint256 timestamp
    );

    error IntentAlreadyFilled();
    error InvalidAmount();
    error TransferFailed();

    function fillIntent(
        uint32 sourceChainIntentId,
        address recipient,
        address token,
        uint256 amount
    ) external nonReentrant {
        // Input validation
        if (amount == 0) revert InvalidAmount();
        
        // Generate unique intent key
        bytes32 intentKey = keccak256(
            abi.encodePacked(sourceChainIntentId, recipient, token, amount)
        );

        // Check if intent already filled
        if (filledIntents[intentKey].filled) revert IntentAlreadyFilled();

        // Update state before transfer
        fillId++;
        filledIntents[intentKey] = FillState({
            filled: true,
            filler: msg.sender,
            amount: amount,
            timestamp: block.timestamp
        });

        // Transfer tokens from filler to recipient
        bool success = IERC20(token).transferFrom(msg.sender, recipient, amount);
        if (!success) revert TransferFailed();
        
        emit IntentFilled(
            sourceChainIntentId,
            msg.sender,
            recipient,
            token,
            amount,
            fillId,
            block.timestamp
        );
    }

    function getIntentState(uint32 sourceChainIntentId, address recipient, address token) 
        external 
        view 
        returns (FillState memory) 
    {
        bytes32 intentKey = keccak256(
            abi.encodePacked(sourceChainIntentId, recipient, token)
        );
        return filledIntents[intentKey];
    }
}