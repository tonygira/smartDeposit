// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./DepositNFT.sol";

/// @title SmartDeposit - A smart contract for managing rental deposits
/// @author Tony Girardo
/// @notice This contract manages rental deposits between landlords and tenants
/// @dev Inherits from OpenZeppelin's Ownable for basic access control
contract SmartDeposit is Ownable {
    DepositNFT private depositNFT;

    /// @notice Represents a rental property with its details and current status
    /// @dev Links a property to its owner and tracks its rental/deposit status
    struct Property {
        uint256 id; /// @notice Unique identifier of the property
        uint256 currentDepositId; /// @notice ID of the current active deposit (if any)
        address landlord; /// @notice Address of the property owner
        string name; /// @notice Name or title of the property
        string location; /// @notice Physical location of the property
        PropertyStatus status; /// @notice Current status of the property
    }

    /// @notice Stores references to IPFS files associated with deposits
    /// @dev Used for storing legal documents and property photos
    struct FileReference {
        string cid; /// @notice IPFS Content Identifier
        uint256 uploadTimestamp; /// @notice When the file was uploaded
        FileType fileType; /// @notice Type of document stored
        address uploader; /// @notice Who uploaded the file
        string fileName; /// @notice Name of the uploaded file
    }

    /// @notice Contains all information about a rental deposit
    /// @dev Tracks the complete lifecycle of a deposit from creation to refund
    struct Deposit {
        uint256 id; /// @notice Unique identifier of the deposit
        uint256 propertyId; /// @notice ID of the associated property
        string depositCode; /// @notice Secret code for tenant payment
        address tenant; /// @notice Address of the tenant
        uint256 amount; /// @notice Total deposit amount in wei
        uint256 finalAmount; /// @notice Final amount after dispute resolution
        uint256 creationDate; /// @notice Timestamp of deposit creation
        uint256 paymentDate; /// @notice Timestamp when tenant paid
        uint256 refundDate; /// @notice Timestamp of refund completion
        DepositStatus status; /// @notice Current status of the deposit
    }

    /// @notice Types of files that can be attached to a property
    enum FileType {
        LEASE, /// @notice Rental agreement document
        PHOTOS, /// @notice Property photos
        ENTRY_INVENTORY, /// @notice Initial property condition report
        EXIT_INVENTORY /// @notice Final property condition report
    }

    /// @notice Possible states of a property
    enum PropertyStatus {
        NOT_RENTED, /// @notice Available for rent
        RENTED, /// @notice Currently rented
        DISPUTED /// @notice Under dispute
    }

    /// @notice Possible states of a deposit
    enum DepositStatus {
        PENDING, /// @notice Created but not paid
        PAID, // @notice Paid by tenant
        DISPUTED, /// @notice Under dispute
        RETAINED, /// @notice Kept by landlord
        PARTIALLY_REFUNDED, /// @notice Partially returned to tenant
        REFUNDED /// @notice Fully returned to tenant
    }

    // State variables
    /// @notice Counter for generating unique property IDs
    uint256 private propertyCounter;
    /// @notice Counter for generating unique deposit IDs
    uint256 private depositCounter;
    /// @notice Maps property IDs to Property structs
    mapping(uint256 => Property) private properties;
    /// @notice Maps deposit IDs to Deposit structs
    mapping(uint256 => Deposit) private deposits;
    /// @notice Maps landlord addresses to their property IDs
    mapping(address => uint256[]) private landlordProperties;
    /// @notice Maps tenant addresses to their deposit IDs
    mapping(address => uint256[]) private tenantDeposits;
    /// @notice Maps property IDs to all deposit IDs (record of all deposits)
    mapping(uint256 => uint256[]) private propertyDeposits;
    /// @notice Maps deposit IDs to arrays of file references
    mapping(uint256 => FileReference[]) private depositFiles;

    // Events
    /// @notice Emitted when a new property is created
    /// @param propertyId Unique ID of the new property
    /// @param landlord Address of the property owner
    /// @param name Name of the property
    /// @param status Initial property status
    event PropertyCreated(
        uint256 indexed propertyId,
        address indexed landlord,
        string name,
        PropertyStatus status
    );

    /// @notice Emitted when a deposit is paid
    event DepositMade(
        uint256 indexed depositId,
        uint256 indexed propertyId,
        address indexed tenant,
        uint256 amount
    );

    /// @notice Emitted when a deposit status changes
    event DepositStatusChanged(uint256 indexed depositId, DepositStatus status);

    /// @notice Emitted when a dispute is initiated
    event DisputeRaised(uint256 indexed depositId, address indexed initiator);

    /// @notice Emitted when a dispute is resolved
    event DisputeResolved(
        uint256 indexed depositId,
        DepositStatus status,
        uint256 refundedAmount
    );

    /// @notice Emitted when a property status changes
    event PropertyStatusChanged(
        uint256 indexed propertyId,
        PropertyStatus status
    );

    /// @notice Emitted when a file is added to a deposit
    event FileAdded(
        uint256 indexed depositId,
        FileType indexed fileType,
        string cid,
        address indexed uploader
    );

    /// @notice Emitted when a new deposit is created
    event DepositCreated(
        uint256 indexed depositId,
        uint256 indexed propertyId,
        string depositCode
    );

    /// @notice Emitted when a deposit is paid by tenant
    event DepositPaid(
        uint256 indexed depositId,
        address indexed tenant,
        address indexed landlord,
        uint256 amount
    );

    /// @notice Emitted when a deposit is refunded
    event DepositRefunded(
        uint256 indexed depositId,
        address indexed tenant,
        address indexed landlord,
        uint256 amount
    );

    /// @notice Emitted when a deposit is partially refunded
    event DepositPartiallyRefunded(
        uint256 indexed depositId,
        address indexed tenant,
        address indexed landlord,
        uint256 amount
    );

    /// @notice Emitted when a deposit is retained
    event DepositRetained(
        uint256 indexed depositId,
        address indexed tenant,
        address indexed landlord,
        uint256 amount
    );

    /// @notice Emitted when a deposit is disputed
    event DepositDisputed(
        uint256 indexed depositId,
        address indexed tenant,
        address indexed landlord,
        uint256 amount
    );

    /// @notice Emitted when ETH are sent to the contract
    event Received(address indexed sender, uint256 amount);

    /// @dev Initialize the contract with the deployer as owner
    /// @param _depositNFT Address of the DepositNFT contract
    constructor(address _depositNFT) Ownable(msg.sender) {
        depositNFT = DepositNFT(_depositNFT);
    }

    // Modifiers
    /// @notice Ensures caller is the landlord of the specified property
    modifier onlyLandlord(uint256 _propertyId) {
        require(
            properties[_propertyId].landlord == msg.sender,
            "Not the landlord"
        );
        _;
    }

    /// @notice Ensures caller is the tenant of the specified deposit
    modifier onlyTenant(uint256 _depositId) {
        require(deposits[_depositId].tenant == msg.sender, "Not the tenant");
        _;
    }

    /// @notice Ensures the property exists
    modifier propertyExists(uint256 _propertyId) {
        require(
            properties[_propertyId].id == _propertyId,
            "Property does not exist"
        );
        _;
    }

    /// @notice Ensures the deposit exists
    modifier depositExists(uint256 _depositId) {
        require(
            deposits[_depositId].id == _depositId,
            "Deposit does not exist"
        );
        _;
    }

    // Functions
    /// @notice Creates a new property listing
    /// @dev Increments propertyCounter and adds property to landlord's portfolio
    /// @param _name Name of the property
    /// @param _location Physical location of the property
    /// @return propertyId The ID of the newly created property
    function createProperty(
        string memory _name,
        string memory _location
    ) external returns (uint256) {
        propertyCounter++;
        uint256 propertyId = propertyCounter;

        properties[propertyId] = Property({
            id: propertyId,
            currentDepositId: 0,
            landlord: msg.sender,
            name: _name,
            location: _location,
            status: PropertyStatus.NOT_RENTED
        });

        landlordProperties[msg.sender].push(propertyId);

        emit PropertyCreated(
            propertyId,
            msg.sender,
            _name,
            PropertyStatus.NOT_RENTED
        );

        return propertyId;
    }

    /// @notice Deletes a property if it has no active deposit
    /// @dev Only the landlord can delete their property
    /// @param _propertyId ID of the property to delete
    function deleteProperty(
        uint256 _propertyId
    ) external propertyExists(_propertyId) onlyLandlord(_propertyId) {
        Property storage property = properties[_propertyId];
        require(
            property.currentDepositId == 0,
            "Cannot delete property with active deposit"
        );

        // Vérifier qu'il n'y a pas d'historique de cautions
        require(
            propertyDeposits[_propertyId].length == 0,
            "Cannot delete property with deposit history"
        );

        // Remove property from landlord's portfolio. 
        // NOTE: this will never be a long loop because the landlord can only have a few properties
        uint256[] storage landlordProps = landlordProperties[property.landlord];
        for (uint256 i = 0; i < landlordProps.length; i++) {
            if (landlordProps[i] == _propertyId) {
                landlordProps[i] = landlordProps[landlordProps.length - 1];
                landlordProps.pop();
                break;
            }
        }

        // Delete property
        delete properties[_propertyId];
    }

    /// @notice Creates a deposit for an existing property
    /// @dev Only the landlord can create a deposit for their property
    /// @dev The deposit can only be created if the property is not already rented
    /// @dev The NOT_RENTED status also handles previous existing deposit that were resolved
    /// @param _propertyId ID of the property for which to create the deposit
    /// @param _depositCode Unique code that will be required for tenant payment
    /// @return depositId The ID of the newly created deposit
    function createDeposit(
        uint256 _propertyId,
        string memory _depositCode
    )
        external
        propertyExists(_propertyId)
        onlyLandlord(_propertyId)
        returns (uint256)
    {
        require(
            properties[_propertyId].status == PropertyStatus.NOT_RENTED,
            "Property not available"
        );
        require(
            properties[_propertyId].currentDepositId == 0,
            "Property already has an active deposit"
        );

        depositCounter++;
        uint256 depositId = depositCounter;

        deposits[depositId] = Deposit({
            id: depositId,
            propertyId: _propertyId,
            depositCode: _depositCode,
            tenant: address(0),
            amount: 0,
            finalAmount: 0,
            creationDate: block.timestamp,
            paymentDate: 0,
            refundDate: 0,
            status: DepositStatus.PENDING
        });

        properties[_propertyId].currentDepositId = depositId; // update current deposit id
        propertyDeposits[_propertyId].push(depositId); // add deposit id to property deposits (record of all deposits)

        emit DepositCreated(depositId, _propertyId, _depositCode);

        return depositId;
    }

    /// @notice Updates the deposit amount for a pending deposit
    /// @dev Only the landlord can update the deposit amount
    /// @param _depositId ID of the deposit to update
    /// @param _amount  deposit amount in wei
    function setDepositAmount(
        uint256 _depositId,
        uint256 _amount
    )
        external
        depositExists(_depositId)
        onlyLandlord(deposits[_depositId].propertyId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");
        require(_amount > 0, "Deposit amount must be greater than 0");

        deposit.amount = _amount;
    }

    /// @notice Allows a tenant to pay a deposit
    /// @dev Verifies deposit code and exact amount before accepting payment
    /// @param _depositId ID of the deposit to pay
    /// @param _depositCode Secret code provided by landlord
    function payDeposit(
        uint256 _depositId,
        string memory _depositCode
    ) external payable depositExists(_depositId) {
        Deposit storage deposit = deposits[_depositId];

        require(
            deposit.status == DepositStatus.PENDING,
            "Deposit not requested"
        );
        require(
            keccak256(bytes(deposit.depositCode)) ==
                keccak256(bytes(_depositCode)),
            "Invalid deposit code"
        );
        require(msg.value == deposit.amount, "Incorrect amount");

        deposit.tenant = msg.sender;
        deposit.paymentDate = block.timestamp;
        deposit.status = DepositStatus.PAID;

        properties[deposit.propertyId].status = PropertyStatus.RENTED;
        tenantDeposits[msg.sender].push(_depositId);

        // Mint NFT for the tenant
        depositNFT.mintDepositNFT(_depositId, msg.sender);

        emit DepositPaid(
            _depositId,
            msg.sender,
            properties[deposit.propertyId].landlord,
            msg.value
        );
        emit PropertyStatusChanged(deposit.propertyId, PropertyStatus.RENTED);
        emit DepositStatusChanged(_depositId, DepositStatus.PAID);

        // Comme le NFT vient d'être créé, pas besoin de vérifier si tokenId > 0
        depositNFT.updateTokenMetadata(_depositId);
    }

    /// @notice Refunds a paid deposit
    /// @dev Only the landlord can refund a deposit
    /// @param _depositId ID of the deposit to refund
    function refundDeposit(
        uint256 _depositId
    )
        external
        depositExists(_depositId)
        onlyLandlord(deposits[_depositId].propertyId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.PAID, "Deposit not paid");

        deposit.status = DepositStatus.REFUNDED;
        deposit.finalAmount = deposit.amount;
        deposit.refundDate = block.timestamp; // Enregistrement de la date de remboursement

        Property storage property = properties[deposits[_depositId].propertyId];
        property.status = PropertyStatus.NOT_RENTED;
        property.currentDepositId = 0; // Libère le bien pour une nouvelle caution

        // Transfer the initial deposit amount to the tenant
        (bool success, ) = payable(deposit.tenant).call{value: deposit.amount}(
            ""
        );
        require(success, "Refund transfer failed");

        emit DepositStatusChanged(_depositId, deposit.status);
        emit PropertyStatusChanged(_depositId, property.status);
        emit DepositRefunded(
            _depositId,
            deposit.tenant,
            properties[deposit.propertyId].landlord,
            deposit.amount
        );

        // Update the NFT metadata
        uint256 tokenId = depositNFT.getTokenIdFromDeposit(_depositId);
        if (tokenId > 0) {
            depositNFT.updateTokenMetadata(_depositId);
        }
    }

    /// @notice Initiates a dispute for a paid deposit
    /// @dev Only the landlord can initiate a dispute
    /// @param _depositId ID of the deposit to dispute
    function initiateDispute(
        uint256 _depositId
    )
        external
        depositExists(_depositId)
        onlyLandlord(deposits[_depositId].propertyId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.PAID, "Deposit not paid");

        deposit.status = DepositStatus.DISPUTED;
        properties[deposit.propertyId].status = PropertyStatus.DISPUTED;

        emit DepositStatusChanged(_depositId, DepositStatus.DISPUTED);
        emit PropertyStatusChanged(deposit.propertyId, PropertyStatus.DISPUTED);
        emit DepositDisputed(
            _depositId,
            deposit.tenant,
            properties[deposit.propertyId].landlord,
            deposit.amount
        );

        // Mettre à jour les métadonnées du NFT
        uint256 tokenId = depositNFT.getTokenIdFromDeposit(_depositId);
        if (tokenId > 0) {
            depositNFT.updateTokenMetadata(_depositId);
        }
    }

    /// @notice Resolves a dispute and handles deposit distribution
    /// @dev Only landlord can resolve, determines final amount
    /// @param _depositId ID of the disputed deposit
    /// @param _refundedAmount Amount to be returned to tenant
    function resolveDispute(
        uint256 _depositId,
        uint256 _refundedAmount
    )
        external
        depositExists(_depositId)
        onlyLandlord(deposits[_depositId].propertyId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(
            deposit.status == DepositStatus.DISPUTED,
            "Deposit not disputed"
        );
        require(_refundedAmount <= deposit.amount, "Refund exceeds deposit");

        deposit.finalAmount = _refundedAmount;
        deposit.refundDate = block.timestamp;
        Property storage property = properties[deposit.propertyId];

        if (_refundedAmount == deposit.amount) {            // full refund
            deposit.status = DepositStatus.REFUNDED;
            (bool success, ) = payable(deposit.tenant).call{
                value: _refundedAmount
            }("");
            require(success, "Refund transfer to tenant failed");
            emit DepositRefunded(
                _depositId,
                deposit.tenant,
                property.landlord,
                _refundedAmount
            );
        } else if (_refundedAmount == 0) {                // retained
            deposit.status = DepositStatus.RETAINED;
            (bool success, ) = payable(properties[deposit.propertyId].landlord)
                .call{value: deposit.amount}("");
            require(success, "Transfer to landlord failed");
            emit DepositRetained(
                _depositId,
                deposit.tenant,
                property.landlord,
                deposit.amount
            );
        } else {                                        // partially refunded
            deposit.status = DepositStatus.PARTIALLY_REFUNDED;
            // Transférer au locataire
            (bool successTenant, ) = payable(deposit.tenant).call{
                value: _refundedAmount
            }("");
            require(successTenant, "Refund transfer to tenant failed");

            // Transférer au propriétaire
            (bool successLandlord, ) = payable(property.landlord).call{
                value: deposit.amount - _refundedAmount
            }("");
            require(successLandlord, "Transfer to landlord failed");
            emit DepositPartiallyRefunded(
                _depositId,
                deposit.tenant,
                property.landlord,
                _refundedAmount
            );
        }

        property.status = PropertyStatus.NOT_RENTED;
        property.currentDepositId = 0; // Libère le bien pour une nouvelle caution

        emit DisputeResolved(_depositId, deposit.status, _refundedAmount);
        emit PropertyStatusChanged(
            deposit.propertyId,
            PropertyStatus.NOT_RENTED
        );
        emit DepositStatusChanged(_depositId, deposit.status);

        // Mettre à jour les métadonnées du NFT
        uint256 tokenId = depositNFT.getTokenIdFromDeposit(_depositId);
        if (tokenId > 0) {
            depositNFT.updateTokenMetadata(_depositId);
        }
    }

    /// @notice Adds a file reference to a deposit
    /// @dev Stores IPFS hash and metadata about the file
    /// @param _depositId ID of the deposit to attach the file to
    /// @param _fileType Type of the file being added
    /// @param _cid IPFS Content Identifier of the file
    /// @param _fileName Name of the uploaded file
    function addDepositFile(
        uint256 _depositId,
        FileType _fileType,
        string memory _cid,
        string memory _fileName
    )
        external
        depositExists(_depositId)
        onlyLandlord(deposits[_depositId].propertyId)
    {
        depositFiles[_depositId].push(
            FileReference({
                cid: _cid,
                uploadTimestamp: block.timestamp,
                fileType: _fileType,
                uploader: msg.sender,
                fileName: _fileName
            })
        );

        emit FileAdded(_depositId, _fileType, _cid, msg.sender);
    }

    // View Functions
    /// @notice Gets all properties owned by a landlord
    /// @param _landlord Address of the landlord
    /// @return Array of property IDs owned by the landlord
    function getLandlordProperties(
        address _landlord
    ) external view returns (uint256[] memory) {
        return landlordProperties[_landlord];
    }

    /// @notice Gets all deposits associated with a tenant
    /// @param _tenant Address of the tenant
    /// @return Array of deposit IDs associated with the tenant
    function getTenantDeposits(
        address _tenant
    ) external view returns (uint256[] memory) {
        return tenantDeposits[_tenant];
    }

    /// @notice Gets all deposits associated with a property (record of all deposits)
    /// @param _propertyId ID of the property to query
    /// @return Array of deposit IDs associated with the property
    function getPropertyDeposits(
        uint256 _propertyId
    )
        external
        view
        propertyExists(_propertyId)
        onlyLandlord(_propertyId)
        returns (uint256[] memory)
    {
        return propertyDeposits[_propertyId];
    }

    /// @notice Gets current active deposit ID for a property
    /// @dev the onlyLandlord modifier cannot be used here because the future tenant will call this function before paying the deposit
    /// @param _propertyId ID of the property to query
    /// @return The ID of the current deposit (0 if none)
    function getDepositIdFromProperty(
        uint256 _propertyId
    ) external view propertyExists(_propertyId) returns (uint256) {
        return properties[_propertyId].currentDepositId;
    }

    /// @notice Gets property ID from deposit ID
    /// @param _depositId ID of the deposit to query
    /// @return The ID of the property associated with the deposit
    function getPropertyIdFromDeposit(
        uint256 _depositId
    )
        external
        view
        depositExists(_depositId)
        onlyTenant(_depositId)
        returns (uint256)
    {
        return deposits[_depositId].propertyId;
    }

    /// @notice Gets details of a specific property
    /// @dev this information will be encrypted with the LIT protocol
    /// @param _propertyId ID of the property to query
    /// @return Property struct containing all property details
    function getProperty(
        uint256 _propertyId
    ) external view propertyExists(_propertyId) returns (Property memory) {
        return properties[_propertyId];
    }

    /// @notice Gets details of a specific deposit
    /// @dev this information will be encrypted with the LIT protocol
    /// @param _depositId ID of the deposit to query
    /// @return Deposit struct containing all deposit details
    function getDeposit(
        uint256 _depositId
    ) external view depositExists(_depositId) returns (Deposit memory) {
        return deposits[_depositId];
    }

    /// @notice Gets all files associated with a deposit
    /// @dev The returned files will be encrypted with the LIT protocol
    /// @dev Returns files for the specified deposit
    /// @param _depositId ID of the deposit to query
    /// @return Array of FileReference structs containing file details
    function getDepositFiles(
        uint256 _depositId
    ) external view depositExists(_depositId) returns (FileReference[] memory) {
        return depositFiles[_depositId];
    }

    /// @notice Obtient l'adresse du contrat DepositNFT
    /// @return L'adresse du contrat DepositNFT
    function getDepositNFTAddress() external view returns (address) {
        return address(depositNFT);
    }

    /// @notice Obtient les informations étendues d'une caution pour le NFT
    /// @param _depositId ID de la caution
    /// @return propertyId ID de la propriété
    /// @return tenant Adresse du locataire
    /// @return amount Montant de la caution
    /// @return status Statut numérique de la caution
    /// @return paymentDate Date de paiement de la caution
    /// @return refundDate Date de remboursement de la caution
    /// @return finalAmount Montant final remboursé
    /// @return landlord Adresse du propriétaire du bien
    function getExtendedDepositInfoForNFT(
        uint256 _depositId
    )
        external
        view
        depositExists(_depositId)
        returns (
            uint256 propertyId,
            address tenant,
            uint256 amount,
            uint256 status,
            uint256 paymentDate,
            uint256 refundDate,
            uint256 finalAmount,
            address landlord
        )
    {
        Deposit storage deposit = deposits[_depositId];
        Property storage property = properties[deposit.propertyId];

        return (
            deposit.propertyId,
            deposit.tenant,
            deposit.amount,
            uint256(deposit.status),
            deposit.paymentDate,
            deposit.refundDate,
            deposit.finalAmount,
            property.landlord
        );
    }

    /// @notice Receive function to trace accidental transfers
    receive() external payable {
        // log des envois accidentels
        emit Received(msg.sender, msg.value);
    }

    fallback() external {
        revert("Function does not exist");
    }
}
