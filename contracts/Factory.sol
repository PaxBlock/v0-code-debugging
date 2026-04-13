// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {AcademicCertificate} from "./AcademicCertificate.sol";

contract UniversityFactory is AccessControl {
    bytes32 public constant FACTORY_ADMIN_ROLE = keccak256("FACTORY_ADMIN_ROLE");

    // Keep track of all deployed universities
    address[] public deployedUniversities;
    
    // Mapping to quickly check if an address is a valid university contract from this factory
    mapping(address => bool) public isUniversityContract;

    event UniversityDeployed(
        address indexed contractAddress, 
        string universityName, 
        address indexed universityAdmin
    );

    constructor() {
        // The deployer of the factory becomes the ultimate Global Admin
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTORY_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Deploys a new AcademicCertificate contract for a specific university.
     * @param universityName The name of the university (e.g., "Harvard University").
     * @param symbol The token symbol (e.g., "HARV").
     * @param universityAdmin The wallet address of the University's Chief Admin.
     */
    function deployUniversity(
        string memory universityName, 
        string memory symbol, 
        address universityAdmin
    ) external onlyRole(FACTORY_ADMIN_ROLE) returns (address) {
        
        // Deploy a new instance of the Academic Certificate contract
        AcademicCertificate newUniversity = new AcademicCertificate(
            universityName, 
            symbol, 
            universityAdmin // This wallet gets the DEFAULT_ADMIN_ROLE in the child contract
        );

        address universityAddress = address(newUniversity);

        // Record the deployment
        deployedUniversities.push(universityAddress);
        isUniversityContract[universityAddress] = true;

        emit UniversityDeployed(universityAddress, universityName, universityAdmin);

        return universityAddress;
    }

    /**
     * @dev Returns the total number of deployed universities.
     */
    function getUniversityCount() external view returns (uint256) {
        return deployedUniversities.length;
    }
}
