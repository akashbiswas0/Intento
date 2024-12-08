// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Test.sol";
import {IntentFillerDeploymentLib} from "./utils/IntentFillerDeploymentLib.sol";

contract IntentFillerDeployer is Script {
    address private deployer;
    IntentFillerDeploymentLib.DeploymentData fillerDeployment;

    function setUp() public virtual {
        deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        vm.label(deployer, "Deployer");
    }

    function run() external {
        console2.log("Deploying IntentFiller contract...");
        
        vm.startBroadcast(deployer);
        
        fillerDeployment = IntentFillerDeploymentLib.deployContracts();
        
        vm.stopBroadcast();

        verifyDeployment();
        IntentFillerDeploymentLib.writeDeploymentJson(fillerDeployment);
        
        console2.log("IntentFiller deployed at:", fillerDeployment.intentFiller);
    }

    function verifyDeployment() internal view {
        require(
            fillerDeployment.intentFiller != address(0),
            "IntentFiller address cannot be zero"
        );
    }
} 