// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./AcademicCertificate.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Factory is AccessControl {
    bytes32 public constant FACTORY_ADMIN_ROLE = keccak256("FACTORY_ADMIN_ROLE");

    address[] public deployedUniversities;
    mapping(address => bool) public isUniversityContract;
    mapping(address => address[]) public _walletUniversities;
    mapping(address => bool) public _deactivated;
    mapping(address => string) public _deactivationReasons;

    event UniversityDeployed(address indexed universityAddress, string indexed universityName, address indexed admin);
    event UniversityDeactivated(address indexed universityAddress, string reason);
    event UniversityReactivated(address indexed universityAddress);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTORY_ADMIN_ROLE, msg.sender);
    }

    function deployUniversity(
        string memory universityName,
        string memory symbol,
        address universityAdmin,
        string memory baseMetadataURI
    ) external onlyRole(FACTORY_ADMIN_ROLE) returns (address) {
        require(universityAdmin != address(0), "Admin cannot be zero address");
        require(bytes(universityName).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");

        AcademicCertificate newUniversity = new AcademicCertificate(
            universityName,
            symbol,
            universityAdmin,
            msg.sender,
            baseMetadataURI
        );

        address universityAddress = address(newUniversity);
        deployedUniversities.push(universityAddress);
        isUniversityContract[universityAddress] = true;

        _walletUniversities[universityAdmin].push(universityAddress);
        
        address[] storage ownerList = _walletUniversities[msg.sender];
        bool exists = false;
        for (uint256 i = 0; i < ownerList.length; i++) {
            if (ownerList[i] == universityAddress) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            ownerList.push(universityAddress);
        }

        emit UniversityDeployed(universityAddress, universityName, universityAdmin);
        return universityAddress;
    }

    function deactivateUniversity(address universityAddress, string memory reason) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(isUniversityContract[universityAddress], "Not a valid university contract");
        require(!_deactivated[universityAddress], "Already deactivated");
        
        _deactivated[universityAddress] = true;
        _deactivationReasons[universityAddress] = reason;
        
        emit UniversityDeactivated(universityAddress, reason);
    }

    function reactivateUniversity(address universityAddress) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(isUniversityContract[universityAddress], "Not a valid university contract");
        require(_deactivated[universityAddress], "Not deactivated");
        
        _deactivated[universityAddress] = false;
        _deactivationReasons[universityAddress] = "";
        
        emit UniversityReactivated(universityAddress);
    }

    function isDeactivated(address universityAddress) external view returns (bool) {
        return _deactivated[universityAddress];
    }

    function deactivationReason(address universityAddress) external view returns (string memory) {
        return _deactivationReasons[universityAddress];
    }

    function getDeployedUniversities() external view returns (address[] memory) {
        return deployedUniversities;
    }

    function getActiveUniversities() external view returns (address[] memory) {
        address[] memory active = new address[](deployedUniversities.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < deployedUniversities.length; i++) {
            if (!_deactivated[deployedUniversities[i]]) {
                active[count] = deployedUniversities[i];
                count++;
            }
        }
        
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = active[i];
        }
        return result;
    }

    function getAllUniversities() external view returns (address[] memory) {
        return deployedUniversities;
    }

    function getWalletUniversities(address wallet) external view returns (address[] memory) {
        return _walletUniversities[wallet];
    }

    function getUniversityCount() external view returns (uint256) {
        return deployedUniversities.length;
    }
}
