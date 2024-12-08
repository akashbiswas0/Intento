import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require('fs');
const path = require('path');
dotenv.config();

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
    throw new Error("process.env object is empty");
}

// Setup env variables
const sourceProvider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const destProvider = new ethers.JsonRpcProvider(process.env.DESTINATION_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, sourceProvider);
const destWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, destProvider);

// Load deployment data and ABIs
const chainId =  "17000"//"31337";
const fillerChainID = "84532"
const bridgeDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/bridge-intent/${chainId}.json`), 'utf8'));
const intentfillerDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/intent-filler/${fillerChainID}.json`), 'utf8'));

// Load ABIs
const bridgeIntentABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/BridgeIntentServiceManager.json'), 'utf8'));
const fillerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IntentFiller.json'), 'utf8'));
const regABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../abis/ECDSAStakeRegistry.json"), 'utf8'));

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

// Add these new contract addresses and ABIs
const coreDeploymentData = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`), 'utf8'));
const delegationManagerAddress = coreDeploymentData.addresses.delegation;
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;

const delegationManagerABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IDelegationManager.json'), 'utf8'));
const avsDirectoryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/IAVSDirectory.json'), 'utf8'));

// Add these new contract initializations
const delegationManager = new ethers.Contract(delegationManagerAddress, delegationManagerABI, wallet);
const avsDirectory = new ethers.Contract(avsDirectoryAddress, avsDirectoryABI, wallet);

// Add the registerOperator function
const registerOperator = async () => {
    try {
        const tx1 = await delegationManager.registerAsOperator({
            __deprecated_earningsReceiver: await wallet.address,
            delegationApprover: "0x0000000000000000000000000000000000000000",
            stakerOptOutWindowBlocks: 0
        }, "");
        await tx1.wait();
        console.log("Operator registered to Core EigenLayer contracts");
    } catch (error) {
        // console.error("Error in registering as operator:", error);
    }
    
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    let operatorSignatureWithSaltAndExpiry = {
        signature: "",
        salt: salt,
        expiry: expiry
    };

    const operatorDigestHash = await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
        wallet.address, 
        await bridgeIntentContract.getAddress(), 
        salt, 
        expiry
    );
    
    const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
    const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);
    operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(operatorSignedDigestHash).serialized;

    const reg = new ethers.Contract(await bridgeIntentContract.stakeRegistry(), regABI, wallet);
    const tx2 = await reg.registerOperatorWithSignature(
        operatorSignatureWithSaltAndExpiry,
        wallet.address
    );
    await tx2.wait();
    console.log("Operator registered on AVS successfully");
};

// Modify the start function to call registerOperator first
const start = async () => {
    console.log("Starting bridge intent operator...");
    // await .operatorRegistered
    
    
    // const add = await bridgeIntentContract.stakeRegistry();
    // console.log("add... ", add);
    // const reg = new ethers.Contract(add, regABI, wallet)
    // const res = await reg.operatorRegistered("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    // const tx2 = await reg.updateOperators(["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"])
    // await tx2.wait();
    // const res2 = await reg.operatorRegistered("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    // console.log("res... ", res, res2);
    try{

        await registerOperator();
    } catch(err){}
    
    fillerContract.on("IntentFilled", async (
        sourceChainIntentId,
        filler,
        recipient,
        token,
        amount,
        ...args // Capture all remaining arguments
    ) => {
        try {
            console.log("Fill event detected, completing intent on source chain");
            
            // The last argument contains the event log
            const eventLog = args[args.length - 1];
            // console.log("Event log:", eventLog); // Debug log
            
            // Get transaction hash from the log
            const fillTransactionHash = eventLog.log?.transactionHash;
            if (!fillTransactionHash) {
                throw new Error(`No transaction hash found in event: ${JSON.stringify(eventLog)}`);
            }
            
            // console.log("Fill transaction hash:", fillTransactionHash);

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
            } else {
                console.log("Intent verification failed:");
                console.log("Expected user:", intentData.user.toLowerCase());
                console.log("Got recipient:", recipient.toLowerCase());
                console.log("Expected token:", intentData.destinationToken.toLowerCase());
                console.log("Got token:", token.toLowerCase());
                console.log("Expected amount:", intentAmount);
                console.log("Got amount:", filledAmount);
            }
        } catch (error) {
            console.error("Error completing intent:", error);
            // if (error.transaction) {
            //     console.log("Transaction details:", {
            //         data: error.transaction.data,
            //         to: error.transaction.to,
            //         from: error.transaction.from
            //     });
            // }
        }
    });

    console.log("Listening for new intents...");
};

start().catch((error) => {
    console.error("Error in start function:", error);
});