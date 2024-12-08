// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {ERC20Mock} from "../../test/ERC20Mock.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

library MockERC20DeploymentLib {
    using stdJson for string;
    using Strings for uint256;

    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct DeploymentData {
        address mockToken;
    }

    function deployContracts() internal returns (DeploymentData memory) {
        DeploymentData memory deployment;
        deployment.mockToken = address(new ERC20Mock());
        return deployment;
    }

    function writeDeploymentJson(DeploymentData memory data) internal {
        writeDeploymentJson("deployments/mock-erc20/", block.chainid, data);
    }

    function writeDeploymentJson(
        string memory outputPath,
        uint256 chainId,
        DeploymentData memory data
    ) internal {
        string memory deploymentData = _generateDeploymentJson(data);

        string memory fileName = string.concat(outputPath, vm.toString(chainId), ".json");
        if (!vm.exists(outputPath)) {
            vm.createDir(outputPath, true);
        }

        vm.writeFile(fileName, deploymentData);
        console2.log("Mock ERC20 deployment artifacts written to:", fileName);
    }

    function _generateDeploymentJson(DeploymentData memory data) internal view returns (string memory) {
        return string.concat(
            '{"lastUpdate":{"timestamp":"',
            vm.toString(block.timestamp),
            '","block_number":"',
            vm.toString(block.number),
            '"},"addresses":',
            _generateAddressesJson(data),
            "}"
        );
    }

    function _generateAddressesJson(DeploymentData memory data) internal pure returns (string memory) {
        return string.concat(
            '{"mockToken":"',
            _addressToString(data.mockToken),
            '"}'
        );
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        return Strings.toHexString(uint160(addr), 20);
    }
} 