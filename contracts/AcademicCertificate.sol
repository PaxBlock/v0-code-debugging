// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AcademicCertificate is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    uint256 private _nextTokenId;

    // Base URL for the metadata API — set once at deploy time by the Factory
    string public baseMetadataURI;

    struct CertificateData {
        string candidateName;  // encrypted
        string courseName;     // encrypted
        string grade;          // encrypted
        string paxId;          // e.g. PHY/2019/054 — stored plain, used for lookup
        uint256 issuanceDate;
        address issuer;
    }

    // Faculty signatory structure — Dean name + signature image URL
    struct FacultySignatory {
        string facultyName;
        string deanName;
        string deanSignatureURL; // Image URL from Blob storage
    }

    // Institutional signature config — set once by admin, applies to all certificates
    struct InstitutionConfig {
        // Core signatories
        string registrarName;
        string registrarSignatureURL; // Registrar's signature image
        string viceChancellorName;
        string viceChancellorSignatureURL; // Vice-Chancellor's signature image
        string deanName;
        string deanSignatureURL; // Dean's signature image
        
        // Verification & branding
        string verificationDomain; // e.g. "verify.oauife.edu.ng"
        string logoURL; // Institution logo for certificate display
    }

    InstitutionConfig public institutionConfig;
    bool public institutionConfigSet;
    
    // Faculty signatories — each institution can have multiple faculties
    FacultySignatory[] public facultySignatories;
    mapping(string => uint256) public facultyNameToIndex; // Quick lookup

    mapping(uint256 => CertificateData) public certificates;
    mapping(address => bool) public hasCertificate;
    mapping(address => uint256) public studentToTokenId;

    // PaxID <-> wallet address lookups
    mapping(string => address) public paxIdToWallet;
    mapping(address => string) public walletToPaxId;

    // Revocation
    mapping(address => bool) public isRevoked;
    mapping(address => string) public revocationReason;
    mapping(address => uint256) public revocationDate;

    event CertificateIssued(uint256 indexed tokenId, address indexed student, string paxId, uint256 timestamp);
    event CertificateRevoked(address indexed student, uint256 indexed tokenId, string reason, address revokedBy, uint256 timestamp);
    event InstitutionConfigUpdated(address updatedBy);

    /**
     * @dev Constructor that grants DEFAULT_ADMIN_ROLE to BOTH the institution admin AND the Pax owner.
     * This allows:
     * - Institution Admin: Issue certificates, manage issuers, verify
     * - Pax Owner: Configure signatories, manage institution settings
     * 
     * @param universityName The name of the institution
     * @param symbol The certificate identifier symbol
     * @param institutionAdmin ANY EVM wallet address - the institution's admin wallet
     * @param paxOwner The Pax owner's wallet (who deployed via Factory)
     * @param _baseMetadataURI Base URI for certificate metadata
     */
    constructor(
        string memory universityName, 
        string memory symbol, 
        address institutionAdmin, 
        address paxOwner,
        string memory _baseMetadataURI
    )
        ERC721(universityName, symbol)
    {
        // Grant DEFAULT_ADMIN_ROLE to the institution admin (can be ANY wallet)
        _grantRole(DEFAULT_ADMIN_ROLE, institutionAdmin);
        
        // Also grant DEFAULT_ADMIN_ROLE to the Pax owner if different from institution admin
        // This allows Pax owner to configure signatories in Step 2
        if (paxOwner != institutionAdmin) {
            _grantRole(DEFAULT_ADMIN_ROLE, paxOwner);
        }
        
        baseMetadataURI = _baseMetadataURI;
    }

    /**
     * @dev ADMIN ONLY: Set the institution's core signatories with signature images, verification domain, and logo.
     * Called once after deployment. Can be updated by admin if personnel or branding changes.
     */
    function setInstitutionConfig(
        string memory registrarName,
        string memory registrarSignatureURL,
        string memory viceChancellorName,
        string memory viceChancellorSignatureURL,
        string memory deanName,
        string memory deanSignatureURL,
        string memory verificationDomain,
        string memory logoURL
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        institutionConfig = InstitutionConfig(
            registrarName,
            registrarSignatureURL,
            viceChancellorName,
            viceChancellorSignatureURL,
            deanName,
            deanSignatureURL,
            verificationDomain,
            logoURL
        );
        institutionConfigSet = true;
        emit InstitutionConfigUpdated(msg.sender);
    }

    /**
     * @dev ADMIN ONLY: Add or update faculty signatories.
     * @param facultyName The name of the faculty (e.g., "Faculty of Science")
     * @param deanName The dean's name
     * @param deanSignatureURL URL to the dean's signature image (from Blob storage)
     */
    function setFacultySignatory(
        string memory facultyName,
        string memory deanName,
        string memory deanSignatureURL
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(facultyName).length > 0, "Faculty name is required");
        require(bytes(deanName).length > 0, "Dean name is required");
        require(bytes(deanSignatureURL).length > 0, "Dean signature URL is required");

        FacultySignatory memory newFaculty = FacultySignatory(facultyName, deanName, deanSignatureURL);
        
        // Check if faculty already exists (use 0 as "not found" sentinel since we store 1-based indices)
        uint256 storedIndex = facultyNameToIndex[facultyName];
        
        if (storedIndex == 0) {
            // Faculty doesn't exist yet, add it
            facultySignatories.push(newFaculty);
            // Store 1-based index (0 means "not found", so we store length which is 1-based)
            facultyNameToIndex[facultyName] = facultySignatories.length;
        } else {
            // Faculty exists, update it (convert stored 1-based index to 0-based for array access)
            facultySignatories[storedIndex - 1] = newFaculty;
        }
    }

    /**
     * @dev Returns all faculty signatories.
     */
    function getFacultySignatories() external view returns (FacultySignatory[] memory) {
        return facultySignatories;
    }

    /**
     * @dev Returns the count of faculties.
     */
    function getFacultyCount() external view returns (uint256) {
        return facultySignatories.length;
    }

    /**
     * @dev ISSUER ONLY: Mints a new certificate NFT.
     * tokenURI is auto-generated from the baseMetadataURI + student address.
     */
    function issueCertificate(
        address student,
        string memory _candidateName,
        string memory _courseName,
        string memory _grade,
        string memory _paxId
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(!hasCertificate[student], "This student already has a certificate.");
        require(bytes(_paxId).length > 0, "PaxID is required.");
        require(paxIdToWallet[_paxId] == address(0), "This PaxID is already in use.");

        uint256 tokenId = _nextTokenId++;

        _safeMint(student, tokenId);

        // Auto-generate tokenURI — includes this contract's own address so the
        // metadata API knows which programme contract to query
        string memory uri = string(abi.encodePacked(
            baseMetadataURI,
            "/api/certificate/",
            _addressToString(student),
            "?contract=",
            _addressToString(address(this))
        ));
        _setTokenURI(tokenId, uri);

        certificates[tokenId] = CertificateData({
            candidateName: _candidateName,
            courseName: _courseName,
            grade: _grade,
            paxId: _paxId,
            issuanceDate: block.timestamp,
            issuer: msg.sender
        });

        hasCertificate[student] = true;
        studentToTokenId[student] = tokenId;
        paxIdToWallet[_paxId] = student;
        walletToPaxId[student] = _paxId;

        emit CertificateIssued(tokenId, student, _paxId, block.timestamp);

        return tokenId;
    }

    /**
     * @dev ADMIN ONLY: Revokes a certificate with a recorded on-chain reason.
     */
    function revokeCertificate(
        address student,
        string memory reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasCertificate[student], "This student does not have a certificate.");
        require(!isRevoked[student], "This certificate is already revoked.");
        require(bytes(reason).length > 0, "A revocation reason is required.");

        uint256 tokenId = studentToTokenId[student];
        isRevoked[student] = true;
        revocationReason[student] = reason;
        revocationDate[student] = block.timestamp;

        emit CertificateRevoked(student, tokenId, reason, msg.sender, block.timestamp);
    }

    /**
     * @dev Resolves a PaxID to a wallet address. Returns zero address if not found.
     */
    function resolvePaxId(string memory paxId) external view returns (address) {
        return paxIdToWallet[paxId];
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("This Certificate is Soulbound and cannot be transferred.");
        }
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
