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
        bridgeIntentContract.removeAllListeners("NewIntentCreated");

        // Listen for new intents on source chain
        bridgeIntentContract.on("NewIntentCreated", async (
            intentId,
            intent
        ) => {
            try {
                console.log(`New intent detected: ${intentId}`);
                console.log("Intent details:", intent);

                const destTokenContract = new ethers.Contract(
                    intent.destinationToken, //mockTokenDeployment.addresses.mockToken,
                    erc20ABI,
                    destWallet
                );

                const approveTx = await destTokenContract.approve(
                    intentfillerDeploymentData.addresses.intentFiller,
                    intent.destinationAmount
                );
                await approveTx.wait();
                console.log("Approved filler contract to spend destination tokens");

                const fillTx = await fillerContract.fillIntent(
                    intentId,
                    intent.user,
                    intent.destinationToken,
                    intent.destinationAmount
                );
                console.log("Fill transaction hash:", fillTx.hash);
                await fillTx.wait();
                console.log("Intent filled on destination chain");

            } catch (error) {
                console.error("Error processing new intent:", error);
            }
        });

        console.log("Listening for new intents...");
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