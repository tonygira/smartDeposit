// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./SmartDeposit.sol";

/// @title DepositNFT - NFT représentant une caution locative
/// @author Tony Girardo
/// @notice Ce contrat gère les NFTs représentant les cautions locatives
/// @dev Hérite de OpenZeppelin ERC721Enumerable pour la gestion des NFTs avec fonctionnalités d'énumération
contract DepositNFT is ERC721Enumerable, Ownable {
    using Strings for uint256;

    address private _smartDepositAddress;
    uint256 private _tokenIds;
    mapping(uint256 => uint256) private _depositIdToTokenId;
    mapping(uint256 => uint256) private _tokenIdToDepositId;
    bool private _initialized;

    // URI de l'image du logo sur IPFS
    string private constant _logoImageURI =
        "https://ipfs.io/ipfs/bafkreibujq7usmtlnaysncqriuwncuk2cjb2nqythu34ozropbeua6siii";

    event DepositNFTMinted(
        uint256 indexed depositId,
        uint256 indexed tokenId,
        address indexed owner
    );

    /// @notice Constructeur du contrat
    /// @dev Initialise le contrat sans lien avec SmartDeposit
    constructor() ERC721("SmartDeposit NFT", "SDNFT") Ownable(msg.sender) {
        _initialized = false;
    }

    /// @notice Initialise le contrat avec l'adresse de SmartDeposit
    /// @dev Ne peut être appelé qu'une seule fois par le owner
    /// @param smartDepositAddress Adresse du contrat SmartDeposit
    function initialize(address smartDepositAddress) external onlyOwner {
        require(!_initialized, "Contract already initialized");
        require(
            smartDepositAddress != address(0),
            "Invalid SmartDeposit address"
        );
        _smartDepositAddress = smartDepositAddress;
        _initialized = true;
    }

    /// @notice Vérifie si le contrat est correctement initialisé
    /// @dev Utilisé comme modificateur interne
    modifier initialized() {
        require(_initialized, "Contract not initialized");
        _;
    }

    /// @notice Mint un nouveau NFT pour une caution
    /// @dev Seul le contrat SmartDeposit peut appeler cette fonction
    /// @param _depositId ID de la caution
    /// @param _owner Adresse du propriétaire du NFT (locataire)
    function mintDepositNFT(
        uint256 _depositId,
        address _owner
    ) external initialized {
        require(
            msg.sender == _smartDepositAddress,
            "Only SmartDeposit can mint"
        );
        require(_owner != address(0), "Invalid owner address");
        require(
            _depositIdToTokenId[_depositId] == 0,
            "NFT already exists for this deposit"
        );

        _tokenIds++;
        uint256 newTokenId = _tokenIds;

        _depositIdToTokenId[_depositId] = newTokenId;
        _tokenIdToDepositId[newTokenId] = _depositId;

        _safeMint(_owner, newTokenId);

        emit DepositNFTMinted(_depositId, newTokenId, _owner);
    }

    /// @notice Récupère l'ID du token associé à une caution
    /// @param _depositId ID de la caution
    /// @return L'ID du token NFT associé
    function getTokenIdFromDeposit(
        uint256 _depositId
    ) external view initialized returns (uint256) {
        return _depositIdToTokenId[_depositId];
    }

    /// @notice Récupère l'ID de la caution associée à un token
    /// @param _tokenId ID du token NFT
    /// @return L'ID de la caution associée
    function getDepositIdFromToken(
        uint256 _tokenId
    ) external view initialized returns (uint256) {
        return _tokenIdToDepositId[_tokenId];
    }

    /// @notice Récupère l'adresse du contrat SmartDeposit
    /// @return L'adresse du contrat SmartDeposit
    function getSmartDepositAddress()
        external
        view
        initialized
        returns (address)
    {
        return _smartDepositAddress;
    }

    /// @notice Retourne le nombre actuel de tokens
    /// @return Le dernier ID de token généré
    function getCurrentTokenCount() external view returns (uint256) {
        return _tokenIds;
    }

    /// @notice Retourne l'URI des métadonnées du NFT
    /// @dev Génère des métadonnées JSON en base64
    /// @param _tokenId ID du token NFT
    /// @return URI des métadonnées
    function tokenURI(
        uint256 _tokenId
    ) public view override initialized returns (string memory) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");

        // Récupérer le depositId associé au token
        uint256 depositId = _tokenIdToDepositId[_tokenId];
        require(depositId != 0, "No deposit associated with this token");

        // Récupérer les informations de la caution depuis SmartDeposit
        (
            uint256 propertyId,
            address tenant,
            uint256 amount,
            uint256 status,
            uint256 payment_timestamp,
            uint256 refund_timestamp,
            uint256 finalAmount,
            address landlord
        ) = SmartDeposit(_smartDepositAddress).getExtendedDepositInfoForNFT(
                depositId
            );

        // Créer les métadonnées JSON avec encodage UTF-8
        string memory json = string(
            abi.encodePacked(
                '{"name": "Caution Locative #',
                depositId.toString(),
                '", "description": "NFT repr\\u00e9sentant une caution locative", ',
                '"image": "',
                _logoImageURI,
                '", ',
                '"attributes": [',
                '{"trait_type": "ID Caution", "value": "',
                depositId.toString(),
                '"}, ',
                '{"trait_type": "Locataire", "value": "',
                _addressToString(tenant),
                '"}, ',
                '{"trait_type": "ID Propri\\u00e9t\\u00e9", "value": "',
                propertyId.toString(),
                '"}, ',
                '{"trait_type": "Propri\\u00e9taire", "value": "',
                _addressToString(landlord),
                '"}, ',
                '{"trait_type": "Statut", "value": "',
                _getStatusString(status),
                '"}, ',
                '{"trait_type": "Montant Initial", "value": "',
                amount.toString(),
                '"}, ',
                '{"trait_type": "Date de Paiement", "value": "',
                _formatTimestamp(payment_timestamp),
                '"}, ',
                '{"trait_type": "Montant Rembours\\u00e9", "value": "',
                finalAmount.toString(),
                '"}, ',
                '{"trait_type": "Date de Remboursement", "value": "',
                _formatTimestamp(refund_timestamp),
                '"}'
            )
        );

        // Fermer le JSON
        json = string(abi.encodePacked(json, "]}"));

        // Encoder le JSON en Base64 et le retourner directement dans l'URI
        bytes memory jsonBytes = bytes(json);
        string memory base64Json = Base64.encode(jsonBytes);

        return
            string(
                abi.encodePacked("data:application/json;base64,", base64Json)
            );
    }

    /// @notice Convertit le statut en string
    function _getStatusString(
        uint256 status
    ) internal pure returns (string memory) {
        if (status == 0) return "En attente";
        if (status == 1) return "Pay\\u00e9e";
        if (status == 2) return "Disput\\u00e9e";
        if (status == 3) return "Retenue";
        if (status == 4) return "Partiellement rembours\\u00e9e";
        if (status == 5) return "Rembours\\u00e9e";
        return "Inconnu";
    }

    /// @notice Convertit une adresse en string
    function _addressToString(
        address _addr
    ) internal pure returns (string memory) {
        return Strings.toHexString(uint256(uint160(_addr)), 20);
    }

    /// @notice Formate un timestamp Unix en date lisible
    /// @dev Convertit le timestamp en format DD/MM/YYYY
    function _formatTimestamp(
        uint256 timestamp
    ) internal pure returns (string memory) {
        // Cette fonction est simplifiée - idéalement, on utiliserait une bibliothèque complète
        // pour gérer les dates correctement, mais pour Solidity c'est complexe
        // Retourne simplement le timestamp pour l'instant
        return timestamp.toString();
    }
}
