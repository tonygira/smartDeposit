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

    /// ************************************************************
    /// TONY TODO :
    /// To refresh token metadata on OpenSea, you can emit on-chain events as defined in ERC-4906:
    /// event MetadataUpdate(uint256 _tokenId);
    /// ************************************************************

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

        // Générer l'image SVG avec l'ID de la caution
        string memory svgImage = generateSVGImage(depositId, amount);
        string memory encodedSvg = Base64.encode(bytes(svgImage));
        string memory imageUri = string.concat(
            "data:image/svg+xml;base64,",
            encodedSvg
        );

        // Créer les métadonnées JSON avec encodage UTF-8
        string memory json = string.concat(
            '{"name": "Caution Locative #',
            depositId.toString(),
            '", "description": "NFT repr\\u00e9sentant une caution locative", ',
            '"image": "',
            imageUri,
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
            payment_timestamp.toString(),
            '"}, ',
            '{"trait_type": "Montant Rembours\\u00e9", "value": "',
            finalAmount.toString(),
            '"}, ',
            '{"trait_type": "Date de Remboursement", "value": "',
            refund_timestamp.toString(),
            '"}'
        );

        // Fermer le JSON
        json = string.concat(json, "]}");

        // Encoder le JSON en Base64 et le retourner directement dans l'URI
        bytes memory jsonBytes = bytes(json);
        string memory base64Json = Base64.encode(jsonBytes);

        return string.concat("data:application/json;base64,", base64Json);
    }

    /// @notice Génère l'image SVG incluant l'ID de caution
    /// @dev Crée un SVG dynamique avec l'ID et le montant de la caution
    /// @param _depositId ID de la caution à afficher sur l'image
    /// @param _amount Montant de la caution
    /// @return Une chaîne contenant le SVG complet
    function generateSVGImage(uint256 _depositId, uint256 _amount) internal pure returns (string memory) {
        // Conversion du montant de wei en ETH de manière sécurisée
        string memory amountInEth;
        if (_amount > 0) {
            // Diviser par 10^18 pour obtenir la valeur en ETH
            uint256 ethWhole = _amount / 1 ether;

            // Calculer les décimales (3 chiffres après la virgule)
            uint256 decimalFactor = 1000;
            uint256 ethDecimal = (_amount % 1 ether) / (1 ether / decimalFactor);

            // Construire la chaîne avec 3 décimales
            amountInEth = string.concat(
                ethWhole.toString(),
                ".",
                ethDecimal < 10 ? "0" : "",
                ethDecimal.toString(),
                " ETH"
            );
        } else {
            amountInEth = "0.000 ETH";
        }

        // Construire le SVG en utilisant string.concat
        return
            string.concat(
                '<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">',
                '<rect width="100%" height="100%" fill="#7759F9" />',
                '<circle cx="250" cy="170" r="150" fill="white" />',
                '<text x="250" y="240" font-family="Arial" font-size="190" font-weight="bold" text-anchor="middle" fill="#7759F9">SD</text>',
                '<text x="250" y="400" font-family="Arial" font-size="70" text-anchor="middle" fill="white">Caution #',
                _depositId.toString(),
                "</text>",
                '<text x="250" y="460" font-family="Arial" font-size="35" text-anchor="middle" fill="white">Montant : ',
                amountInEth,
                "</text>",
                "</svg>"
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
    /// @dev Convertit l'adresse en une chaîne hexadécimale de 20 caractères en utilisant la bibliothèque Strings
    function _addressToString(
        address _addr
    ) internal pure returns (string memory) {
        return Strings.toHexString(uint256(uint160(_addr)), 20);
    }
}
