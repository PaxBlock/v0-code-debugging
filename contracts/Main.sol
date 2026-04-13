// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AcademicCertificate is ERC721, ERC721URIStorage, AccessControl {
    // Define the Roles
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    uint256 private _nextTokenId;

    struct CertificateData {
        string candidateName;
        string courseName;
        uint256 issuanceDate;
        address issuer;
    }

    mapping(uint256 => CertificateData) public certificates;
    mapping(address => bool) public hasCertificate;
    mapping(address => uint256) public studentToTokenId;

    event CertificateIssued(uint256 indexed tokenId, address indexed student, string course, uint256 timestamp);
    event CertificateUpdated(uint256 indexed tokenId, string newName, string newCourse, address updatedBy);

    // The factory passes the university's admin address during deployment
    constructor(string memory universityName, string memory symbol, address defaultAdmin) 
        ERC721(universityName, symbol) 
    {
        // Grant the deployer (or specified admin) the default admin role
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @dev ISSUER ONLY: Mints a new certificate.
     */
    function issueCertificate(
        address student, 
        string memory tokenURI, 
        string memory _candidateName, 
        string memory _courseName
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(!hasCertificate[student], "This student already has a certificate!");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(student, tokenId);
        _setTokenURI(tokenId, tokenURI);

        certificates[tokenId] = CertificateData({
            candidateName: _candidateName,
            courseName: _courseName,
            issuanceDate: block.timestamp,
            issuer: msg.sender
        });

        hasCertificate[student] = true;
        studentToTokenId[student] = tokenId;

        emit CertificateIssued(tokenId, student, _courseName, block.timestamp);

        return tokenId;
    }

    /**
     * @dev UPDATER ONLY: Allows an admin/operator to fix typos in the certificate data.
     */
    function updateCertificateData(
        uint256 tokenId, 
        string memory _newName, 
        string memory _newCourse,
        string memory newTokenURI
    ) external onlyRole(UPDATER_ROLE) {
        require(ownerOf(tokenId) != address(0), "Certificate does not exist");

        // Update on-chain data
        certificates[tokenId].candidateName = _newName;
        certificates[tokenId].courseName = _newCourse;
        
        // Update IPFS metadata URI
        _setTokenURI(tokenId, newTokenURI);

        emit CertificateUpdated(tokenId, _newName, _newCourse, msg.sender);
    }

    function getMyCertificate() external view returns (string memory, string memory, uint256, address, string memory) {
        require(hasCertificate[msg.sender], "You do not have a certificate yet.");
        uint256 myTokenId = studentToTokenId[msg.sender];
        CertificateData memory cert = certificates[myTokenId];
        return (cert.candidateName, cert.courseName, cert.issuanceDate, cert.issuer, tokenURI(myTokenId));
    }

    function verifyCertificate(uint256 tokenId) external view returns (string memory, string memory, uint256, address, address) {
        require(ownerOf(tokenId) != address(0), "Certificate does not exist");
        CertificateData memory cert = certificates[tokenId];
        return (cert.candidateName, cert.courseName, cert.issuanceDate, cert.issuer, ownerOf(tokenId));
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("This Certificate is Soulbound and cannot be transferred");
        }
        return super._update(to, tokenId, auth);
    }

    // Required OpenZeppelin overrides for multiple inheritance
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}