# Intent AVS

![image](https://github.com/user-attachments/assets/07647238-eea9-45a0-a000-3318c4e4b466)


## Introduction

The Intent AVS is a AVS designed to facilitate cross-chain bridging using cross chain intents. It leverages AVS smart contracts to create intents for bridging tokens from a source chain to a destination chain. The system consists of several components, including the Intent AVS (AVS Contract), Intent Filler Contract, and AVS Operators, which work together to ensure secure and efficient token transfers. It is currently live on holesky and base sepolia testnet.

## dapp deployment link:
https://intent-avs.vercel.app/ 

## demo:
https://drive.google.com/file/d/19C3e1sOakdA0DoRB5Zg3kVEyXA7N42Zg/view?usp=sharing

## contract deployment address can be found here:
https://github.com/AnirudhaGitHub/Intent-AVS/tree/master/avs/contracts/deployments

## Architecture

![image](https://github.com/user-attachments/assets/96d16317-36c5-4ddc-9a19-92f86eac4bd4)


### Components

1. **Intent AVS Provider (AVS Contract)**
   - A smart contract where users create intents to bridge tokens from a source chain to a destination chain.

2. **Intent Filler Contract**
   - Deployed on the destination chain, this contract listens for events from the AVS contract and facilitates the transfer of destination tokens to the user.

3. **AVS Operators**
   - Entities that listen to events emitted by the Intent Filler contract to verify the correctness of the fill data and complete the intent by sending source tokens to the filler on the source chain.

### Workflow

1. **User Interaction**
   - Users interact with the Intent AVS Provider to create intents specifying the source and destination tokens and chains.

2. **Event Emission**
   - The AVS contract emits events when a new intent is created.

3. **Intent Filling**
   - The Intent Filler contract on the destination chain listens for these events and transfers the specified amount of destination tokens to the user.

4. **Verification and Completion**
   - AVS Operators listen to events from the Intent Filler contract, verify the transaction details, and complete the intent by transferring source tokens to the filler on the source chain.

## Running the Project On testnet

### Prerequisites

The following instructions explain how to manually deploy the AVS from scratch including EigenLayer and AVS specific contracts using Foundry (forge) to a local anvil chain, and start Typescript Operator application and tasks.

Install dependencies:

- [Node](https://nodejs.org/en/download/)
- [Typescript](https://www.typescriptlang.org/download)
- [ts-node](https://www.npmjs.com/package/ts-node)
- [tcs](https://www.npmjs.com/package/tcs#installation)
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Foundry](https://getfoundry.sh/)
- [ethers](https://www.npmjs.com/package/ethers)

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/AnirudhaGitHub/Intent-AVS.git
   cd Intent-AVS
   ```

2. **Install Dependencies **

   ```bash
   npm install
   ```
3. **Environment Setup**

   - Create a `.env` file in the root directory liek env.example in both global env and inside contract folder

### Running the Services
(Note that private key address must have destination token on destaination chain. and eth for paying gas)
1. **Start the Filler Service**

   ```bash
   npm run start:filler
   ```

2. **Start the Operator Service**

   ```bash
   npm run start:operator
   ```

4. then go to https://intent-avs.vercel.app/ 
start bridging token.

## Running the Project On Local


start anvil chain
```bash
   npm run start:anvil
   ```

### Deploy Contracts and Start Operator
   - Create a `.env` file in the root directory liek env.example in both global env and inside contract folder
Open a separate terminal window #2, execute the following commands

```sh
# Setup .env file
cp .env.example .env
cp contracts/.env.example contracts/.env

# Updates dependencies if necessary and builds the contracts 
npm run build

# Deploy the EigenLayer contracts
npm run deploy:core-local

# Deploy the intent AVS contracts
npm run deploy:deploy:intent-local

# Deploy the intent filler contracts
npm run deploy:deploy:intentfiller-local

# Deploy the mock-erc20 contracts
npm run deploy:deploy:mock-erc20-local

#  Update ABIs
npm run extract:abis

```

### Running the Services

1. **Start the Filler Service**

   ```bash
   npm run start:filler-local
   ```

2. **Start the Operator Service**

   ```bash
   npm run start:operator-local
   ```
3. **Start the create intent service**

   ```bash
   npm run start:traffic-local
   ```


