import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
let chainId = 31337;

const avsDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/bridge-intent/${chainId}.json`), 'utf8'));
const bridgeIntentServiceManagerAddress = avsDeploymentData.addresses.bridgeIntentServiceManager;
const bridgeIntentServiceManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/BridgeIntentServiceManager.json'), 'utf8'));
const erc20ABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/ERC20.json'), 'utf8'));

// Initialize contract objects from ABIs
const bridgeIntentServiceManager = new ethers.Contract(
    bridgeIntentServiceManagerAddress, 
    bridgeIntentServiceManagerABI, 
    wallet
);

// Load mock token deployment data
const mockTokenDeployment = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/mock-erc20/${chainId}.json`), 'utf8'));

// Update TEST_TOKENS to use deployed mock token
const TEST_TOKENS = {
    'MOCK': mockTokenDeployment.addresses.mockToken
};

const TEST_CHAINS = {
    'Ethereum': 1,
    "Base": 8453
};

// Function to generate random intent parameters
function generateRandomIntent() {
    const tokens = Object.values(TEST_TOKENS);
    const chains = Object.values(TEST_CHAINS);
    
    const sourceToken = tokens[Math.floor(Math.random() * tokens.length)];
    const destToken = tokens[Math.floor(Math.random() * tokens.length)];
    const destChain = chains[Math.floor(Math.random() * chains.length)];
    
    // Generate random amounts between 1-1000 units
    const sourceAmount = ethers.parseUnits(
        (Math.random() * 1000 + 1).toFixed(6),
        6
    );
    
    // Calculate 0.1% fee using ethers (0.1% = 0.001)
    const fillerFee = (sourceAmount * BigInt(1000)) / BigInt(1000000);
    const destAmount = sourceAmount - fillerFee;

    return {
        sourceToken,
        sourceAmount,
        destChain,
        destToken,
        destAmount,
        fillerFee
    };
}

async function createNewIntent() {
    try {
        const intent = generateRandomIntent();
        
        console.log(`Creating new intent:
            Source Token: ${intent.sourceToken}
            Source Amount: ${intent.sourceAmount}
            Destination Chain: ${intent.destChain}
            Destination Token: ${intent.destToken}
            Destination Amount: ${intent.destAmount}
            Filler Fee: ${intent.fillerFee}
        `);

        // approve the bridgeIntentServiceManager to spend the source token
        const sourceTokenContract = new ethers.Contract(intent.sourceToken, erc20ABI, wallet);
        const txn = await sourceTokenContract.approve(bridgeIntentServiceManagerAddress, intent.sourceAmount);
        await txn.wait();

        // get source token funds on wallet
        

        // Send transaction to create intent
        const tx = await bridgeIntentServiceManager.createIntent(
            intent.sourceToken,
            intent.sourceAmount,
            intent.destChain,
            intent.destToken,
            intent.destAmount,
            intent.fillerFee
        );
        
        const receipt = await tx.wait();
        console.log(`Intent created successfully! TX Hash: ${receipt.hash}`);

    } catch (error) {
        console.error('Error creating intent:', error);
    }
}

// Create new intents every 30 seconds
function startCreatingIntents() {
    setInterval(() => {
        console.log('Creating new bridge intent...');
        createNewIntent();
    }, 30000);
}

// Start creating intents
console.log('Starting intent generator...');
startCreatingIntents();