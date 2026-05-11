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

    // Deactivation — Owner can remove a university from the platform
    // Existing certificates remain verifiable but no new ones can be issued
    mapping(address => bool) public isDeactivated;
    mapping(address => string) public deactivationReason;
    mapping(address => uint256) public deactivationDate;

    /**
     * @dev Tracks which university contracts a wallet is associated with.
     * Updated when a university is deployed (admin) or when a role is granted (issuer).
     * This allows the dApp to instantly fetch a wallet's universities with 1 call
     * instead of looping through every contract checking roles individually.
     */
    mapping(address => address[]) private _walletUniversities;

    event UniversityDeployed(
        address indexed contractAddress,
        string universityName,
        address indexed universityAdmin
    );

    event UniversityDeactivated(
        address indexed contractAddress,
        string reason,
        address indexed deactivatedBy,
        uint256 timestamp
    );

    event UniversityReactivated(
        address indexed contractAddress,
        address indexed reactivatedBy,
        uint256 timestamp
    );

    event WalletRoleGranted(
        address indexed universityContract,
        address indexed wallet
    );

    constructor() {
        // The deployer of the factory becomes the ultimate Global Admin
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FACTORY_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Deploys a new AcademicCertificate contract for a specific university.
     * @param universityName The name of the university (e.g., "University of Lagos - BSc").
     * @param symbol The token symbol (e.g., "UNILAG").
     * @param universityAdmin The wallet address of the University Chief Admin.
     */
    function deployUniversity(
        string memory universityName,
        string memory symbol,
        address universityAdmin,
        string memory baseMetadataURI
    ) external onlyRole(FACTORY_ADMIN_ROLE) returns (address) {

        // Deploy a new instance of the Academic Certificate contract
        AcademicCertificate newUniversity = new AcademicCertificate(
            universityName,
            symbol,
            universityAdmin,
            baseMetadataURI
        );

        address universityAddress = address(newUniversity);

        // Grant DEFAULT_ADMIN_ROLE to the Pax Owner (deployer) so they can configure signatories
        // This allows the Pax Owner to call setInstitutionConfig in Step 2
        if (msg.sender != universityAdmin) {
            newUniversity.grantRole(newUniversity.DEFAULT_ADMIN_ROLE(), msg.sender);
        }

        // Record the deployment globally
        deployedUniversities.push(universityAddress);
        isUniversityContract[universityAddress] = true;

        // Record that the admin wallet is associated with this university contract
        _walletUniversities[universityAdmin].push(universityAddress);

        emit UniversityDeployed(universityAddress, universityName, universityAdmin);

        return universityAddress;
    }

    /**
     * @dev Called by the dApp when an admin grants ISSUER_ROLE to a wallet.
     * Records the association so the issuer's wallet appears in their Issue tab.
     * Only valid university contracts from this factory can be registered.
     * @param universityContract The university contract address.
     * @param wallet The wallet being granted issuer access.
     */
    function registerIssuer(
        address universityContract,
        address wallet
    ) external {
        require(isUniversityContract[universityContract], "Not a valid university contract from this factory.");

        // Check the caller is actually an admin on that university contract
        AcademicCertificate univContract = AcademicCertificate(universityContract);
        require(
            univContract.hasRole(univContract.DEFAULT_ADMIN_ROLE(), msg.sender),
            "Only the university admin can register an issuer."
        );

        // Avoid duplicates in the wallet's list
        address[] storage list = _walletUniversities[wallet];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == universityContract) return;
        }

        list.push(universityContract);

        emit WalletRoleGranted(universityContract, wallet);
    }

    /**
     * @dev Returns all university contracts a wallet is associated with (as admin or issuer).
     * The dApp calls this once on wallet connect instead of looping through all contracts.
     * @param wallet The wallet address to look up.
     */
    function getWalletUniversities(address wallet) external view returns (address[] memory) {
        return _walletUniversities[wallet];
    }

    /**
     * @dev Returns the total number of deployed universities (including deactivated).
     */
    function getUniversityCount() external view returns (uint256) {
        return deployedUniversities.length;
    }

    /**
     * @dev OWNER ONLY: Deactivates a university from the platform.
     * Existing certificates remain verifiable on-chain forever — this only
     * hides the institution from the dApp and prevents new certificate issuance.
     * @param universityContract The university contract to deactivate.
     * @param reason The reason for deactivation (recorded on-chain permanently).
     */
    function deactivateUniversity(
        address universityContract,
        string memory reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isUniversityContract[universityContract], "Not a valid university contract from this factory.");
        require(!isDeactivated[universityContract], "University is already deactivated.");
        require(bytes(reason).length > 0, "A deactivation reason is required.");

        isDeactivated[universityContract] = true;
        deactivationReason[universityContract] = reason;
        deactivationDate[universityContract] = block.timestamp;

        emit UniversityDeactivated(universityContract, reason, msg.sender, block.timestamp);
    }

    /**
     * @dev OWNER ONLY: Reactivates a previously deactivated university.
     * @param universityContract The university contract to reactivate.
     */
    function reactivateUniversity(
        address universityContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isUniversityContract[universityContract], "Not a valid university contract from this factory.");
        require(isDeactivated[universityContract], "University is not currently deactivated.");

        isDeactivated[universityContract] = false;
        delete deactivationReason[universityContract];
        delete deactivationDate[universityContract];

        emit UniversityReactivated(universityContract, msg.sender, block.timestamp);
    }

    /**
     * @dev Returns all active (non-deactivated) university contracts.
     * Used by the dApp to display the live institution list.
     */
    function getActiveUniversities() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < deployedUniversities.length; i++) {
            if (!isDeactivated[deployedUniversities[i]]) count++;
        }
        address[] memory active = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < deployedUniversities.length; i++) {
            if (!isDeactivated[deployedUniversities[i]]) {
                active[idx++] = deployedUniversities[i];
            }
        }
        return active;
    }

    /**
     * @dev Returns ALL university contracts including deactivated ones.
     * Used by the Owner's admin view to manage all institutions.
     */
    function getAllUniversities() external view returns (address[] memory) {
        return deployedUniversities;
    }
}
