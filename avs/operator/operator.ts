import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Use WebSocket providers for better event handling
const sourceProvider = new ethers.WebSocketProvider(process.env.WS_RPC_URL!);
const destProvider = new ethers.WebSocketProvider(process.env.DESTINATION_WS_RPC_URL!);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, sourceProvider);
const destWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, destProvider);

// Load deployment data and ABIs
const chainId =  "17000"//"31337";
const fillerChainID = "84532"
const bridgeDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/bridge-intent/${chainId}.json`), 'utf8'));
const intentfillerDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/intent-filler/${fillerChainID}.json`), 'utf8'));
const mockTokenDeployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/mock-erc20/${chainId}.json`), 'utf8'));

// Load ABIs
const bridgeIntentABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/BridgeIntentServiceManager.json'), 'utf8'));
const fillerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IntentFiller.json'), 'utf8'));
const mockTokenABI = [
    "function mint(address to, uint256 amount) public",
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)"
];
const erc20ABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/ERC20.json'), 'utf8'));

// Initialize contracts
const bridgeIntentContract = new ethers.Contract(
    bridgeDeploymentData.addresses.bridgeIntentServiceManager,
    bridgeIntentABI,
    wallet
);

const fillerContract = new ethers.Contract(
    intentfillerDeploymentData.addresses.intentFiller,
    fillerABI,
    destWallet
);

const start = async () => {
    console.log("Starting bridge intent operator...");

    const setupEventListener = () => {
        // Remove any existing listeners
        fillerContract.removeAllListeners("IntentFilled");

        // Listen for IntentFilled events
        fillerContract.on("IntentFilled", async (
            sourceChainIntentId,
            filler,
            recipient,
            token,
            amount,
            ...args // Capture all remaining arguments
        ) => {
            try {
                console.log("Fill event detected, completing intent on destination chain");

                    // The last argument contains the event log
                const eventLog = args[args.length - 1];
                // console.log("Event log:", eventLog); // Debug log
                
                // Get transaction hash from the log
                const fillTransactionHash = eventLog.log?.transactionHash;
                if (!fillTransactionHash) {
                    throw new Error(`No transaction hash found in event: ${JSON.stringify(eventLog)}`);
                }
                console.log("Fill transaction hash:", fillTransactionHash);

                // Verify the intent matches
                const intentData = await bridgeIntentContract.intents(sourceChainIntentId);
                
                // Convert amounts to strings for comparison
                const intentAmount = intentData.destinationAmount.toString();
                const filledAmount = amount.toString();

                if (
                    intentData.user.toLowerCase() === recipient.toLowerCase() &&
                    intentData.destinationToken.toLowerCase() === token.toLowerCase() &&
                    intentAmount === filledAmount
                ) {
                    console.log("Intent verification passed, preparing completion...");
                    
                    const messageHash = ethers.solidityPackedKeccak256(
                        ["uint32", "bytes32"],
                        [sourceChainIntentId, fillTransactionHash]
                    );
                    
                    const signature = await wallet.signMessage(
                        ethers.getBytes(messageHash)
                    );
                    
                    const tx = await bridgeIntentContract.completeIntent(
                        sourceChainIntentId,
                        fillTransactionHash,
                        filler,
                        signature,
                        { gasLimit: 500000 }
                    );
                    
                    await tx.wait();
                    console.log(`Intent ${sourceChainIntentId} completed successfully`);
                }
            } catch (error) {
                console.error("Error completing intent:", error);
            }
        });

        console.log("Listening for IntentFilled events...");
    };

    // Initial setup
    setupEventListener();

    // Handle network changes
    sourceProvider.on("network", (newNetwork, oldNetwork) => {
        if (oldNetwork) {
            console.log("Network changed, resetting listeners...");
            setupEventListener();
        }
    });

    destProvider.on("network", (newNetwork, oldNetwork) => {
        if (oldNetwork) {
            console.log("Destination network changed, resetting listeners...");
            setupEventListener();
        }
    });
};

start().catch((error) => {
    console.error("Error in start function:", error);
});