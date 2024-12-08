// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Test.sol";
import {ERC20Mock} from "../test/ERC20Mock.sol";
import {MockERC20DeploymentLib} from "./utils/MockERC20DeploymentLib.sol";

contract DeployMockERC20Script is Script {
    address private deployer;

    function setUp() public {
        deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        vm.label(deployer, "Deployer");
    }

    function run() external {
        console2.log("Deploying Mock ERC20 contract...");
        
        vm.startBroadcast(deployer);
        
        MockERC20DeploymentLib.DeploymentData memory deployment = MockERC20DeploymentLib.deployContracts();
        
        // Mint tokens to deployer (1000 tokens with 18 decimals)
        ERC20Mock(deployment.mockToken).mint(deployer, 1000 * 10**18);
        
        vm.stopBroadcast();

        verifyDeployment(deployment);
        MockERC20DeploymentLib.writeDeploymentJson(deployment);
        
        console2.log("Mock ERC20 deployed at:", deployment.mockToken);
    }

    function verifyDeployment(MockERC20DeploymentLib.DeploymentData memory deployment) internal view {
        require(deployment.mockToken != address(0), "Mock token address cannot be zero");
    }
} 