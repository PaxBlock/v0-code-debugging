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

    // Institutional signature config — set once by admin, applies to all certificates
    struct InstitutionConfig {
        string deanName;
        string registrarName;
        string viceChancellorName;
        string verificationDomain; // e.g. "verify.oauife.edu.ng"
    }

    InstitutionConfig public institutionConfig;
    bool public institutionConfigSet;

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

    constructor(string memory universityName, string memory symbol, address defaultAdmin, string memory _baseMetadataURI)
        ERC721(universityName, symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        baseMetadataURI = _baseMetadataURI;
    }

    /**
     * @dev ADMIN ONLY: Set the institution's signatory names and verification domain.
     * Called once after deployment. Can be updated by admin if personnel changes.
     */
    function setInstitutionConfig(
        string memory deanName,
        string memory registrarName,
        string memory viceChancellorName,
        string memory verificationDomain
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        institutionConfig = InstitutionConfig(deanName, registrarName, viceChancellorName, verificationDomain);
        institutionConfigSet = true;
        emit InstitutionConfigUpdated(msg.sender);
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
