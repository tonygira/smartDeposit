// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SmartDeposit - A smart contract for managing rental deposits
/// @author Tony Girardo
/// @notice This contract manages rental deposits between landlords and tenants
/// @dev Inherits from OpenZeppelin's Ownable for basic access control
contract SmartDeposit is Ownable {
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

    /// @notice Stores references to IPFS files associated with properties
    /// @dev Used for storing legal documents and property photos
    struct FileReference {
        string cid; /// @notice IPFS Content Identifier
        uint256 uploadTimestamp; /// @notice When the file was uploaded
        FileType fileType; /// @notice Type of document stored
        address uploader; /// @notice Who uploaded the file
        string fileName; /// @notice Name of the uploaded file
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
        PAID, /// @notice Paid by tenant
        DISPUTED, /// @notice Under dispute
        RETAINED, /// @notice Kept by landlord
        PARTIALLY_REFUNDED, /// @notice Partially returned to tenant
        REFUNDED /// @notice Fully returned to tenant
    }

    // State variables
    /// @notice Counter for generating unique property IDs
    uint256 public propertyCounter;
    /// @notice Counter for generating unique deposit IDs
    uint256 public depositCounter;

    /// @dev This constant is used to limit the number of properties a landlord can have
    uint16 public constant MAX_PROPERTIES_PER_LANDLORD = 1000;

    /// @dev This struct is an optimized approach to limit the number of properties a landlord can have
    struct LimitedProperty {
        uint16[MAX_PROPERTIES_PER_LANDLORD] properties;
        uint16 count;
    }

    /// @notice Maps property IDs to Property structs
    mapping(uint256 => Property) private properties;
    /// @notice Maps deposit IDs to Deposit structs
    mapping(uint256 => Deposit) private deposits;
    /// @notice Maps landlord addresses to their property IDs
    mapping(address => LimitedProperty) private landlordProperties;
    /// @notice Maps tenant addresses to their deposit IDs
    mapping(address => uint256[]) private tenantDeposits;
    /// @notice Maps property IDs to all deposit IDs (historique)
    mapping(uint256 => uint256[]) private propertyDeposits;
    /// @notice Maps property IDs and file types to arrays of file references
    mapping(uint256 => mapping(FileType => FileReference[]))
        private propertyFiles;

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

    /// @notice Emitted when a file is added to a property
    event FileAdded(
        uint256 indexed propertyId,
        FileType indexed fileType,
        string cid,
        address indexed uploader
    );

    /// @notice Emitted when a new deposit is created
    event DepositCreated(
        uint256 indexed depositId,
        uint256 indexed propertyId,
        uint256 amount,
        string depositCode
    );

    /// @notice Emitted when a deposit is paid by tenant
    event DepositPaid(
        uint256 indexed depositId,
        address indexed tenant,
        uint256 amount
    );

    /// @dev Initialize the contract with the deployer as owner
    constructor() Ownable(msg.sender) {}

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

        // Utilise une structure LimitedProperty au lieu d'un tableau dynamique
        LimitedProperty storage landlordProps = landlordProperties[msg.sender];
        require(
            landlordProps.count < MAX_PROPERTIES_PER_LANDLORD,
            "Max properties limit reached"
        );
        landlordProps.properties[landlordProps.count] = uint16(propertyId);
        landlordProps.count++;

        emit PropertyCreated(
            propertyId,
            msg.sender,
            _name,
            PropertyStatus.NOT_RENTED
        );

        return propertyId;
    }

    /// @notice Creates a deposit for an existing property
    /// @dev Only the landlord can create a deposit for their property
    /// @param _propertyId ID of the property for which to create the deposit
    /// @param _depositCode Unique code that will be required for tenant payment
    /// @param _depositAmount Amount required for the deposit in wei
    /// @return depositId The ID of the newly created deposit
    function createDeposit(
        uint256 _propertyId,
        string memory _depositCode,
        uint256 _depositAmount
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

        // Vérifier que la caution précédente a été clôturée si elle existe
        uint256 currentDepositId = properties[_propertyId].currentDepositId;
        if (currentDepositId > 0) {
            DepositStatus currentStatus = deposits[currentDepositId].status;
            require(
                currentStatus == DepositStatus.REFUNDED ||
                    currentStatus == DepositStatus.PARTIALLY_REFUNDED ||
                    currentStatus == DepositStatus.RETAINED,
                "Previous deposit not closed"
            );
        }

        depositCounter++;
        uint256 depositId = depositCounter;

        deposits[depositId] = Deposit({
            id: depositId,
            propertyId: _propertyId,
            depositCode: _depositCode,
            tenant: address(0),
            amount: _depositAmount,
            finalAmount: 0,
            creationDate: block.timestamp,
            paymentDate: 0,
            refundDate: 0,
            status: DepositStatus.PENDING
        });

        // Mettre à jour la caution actuelle et conserver l'historique
        properties[_propertyId].currentDepositId = depositId;
        propertyDeposits[_propertyId].push(depositId);

        properties[_propertyId].status = PropertyStatus.NOT_RENTED;

        emit DepositCreated(
            depositId,
            _propertyId,
            _depositAmount,
            _depositCode
        );
        emit PropertyStatusChanged(_propertyId, PropertyStatus.NOT_RENTED);

        return depositId;
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

        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");
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

        emit DepositPaid(_depositId, msg.sender, msg.value);
        emit PropertyStatusChanged(deposit.propertyId, PropertyStatus.RENTED);
        emit DepositStatusChanged(_depositId, DepositStatus.PAID);
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

        payable(deposit.tenant).transfer(deposit.amount);

        emit DepositStatusChanged(_depositId, deposit.status);
        emit PropertyStatusChanged(_depositId, property.status);
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

        emit DisputeRaised(_depositId, msg.sender);
        emit DepositStatusChanged(_depositId, DepositStatus.DISPUTED);
        emit PropertyStatusChanged(deposit.propertyId, PropertyStatus.DISPUTED);
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

        if (_refundedAmount == deposit.amount) {
            deposit.status = DepositStatus.REFUNDED;
            payable(deposit.tenant).transfer(_refundedAmount);
        } else if (_refundedAmount == 0) {
            deposit.status = DepositStatus.RETAINED;
            payable(properties[deposit.propertyId].landlord).transfer(
                deposit.amount
            );
        } else {
            deposit.status = DepositStatus.PARTIALLY_REFUNDED;
            payable(deposit.tenant).transfer(_refundedAmount);
            payable(properties[deposit.propertyId].landlord).transfer(
                deposit.amount - _refundedAmount
            );
        }

        properties[deposit.propertyId].status = PropertyStatus.NOT_RENTED;

        emit DisputeResolved(_depositId, deposit.status, _refundedAmount);
        emit PropertyStatusChanged(
            deposit.propertyId,
            PropertyStatus.NOT_RENTED
        );
    }

    /// @notice Adds a file reference to a property
    /// @dev Stores IPFS hash and metadata about the file
    /// @param _propertyId ID of the property to attach the file to
    /// @param _fileType Type of the file being added
    /// @param _cid IPFS Content Identifier of the file
    /// @param _fileName Name of the uploaded file
    function addFile(
        uint256 _propertyId,
        FileType _fileType,
        string memory _cid,
        string memory _fileName
    ) external propertyExists(_propertyId) onlyLandlord(_propertyId) {
        propertyFiles[_propertyId][_fileType].push(
            FileReference({
                cid: _cid,
                uploadTimestamp: block.timestamp,
                fileType: _fileType,
                uploader: msg.sender,
                fileName: _fileName
            })
        );

        emit FileAdded(_propertyId, _fileType, _cid, msg.sender);
    }

    // View Functions
    /// @notice Helper function to find property index in landlord properties array
    /// @dev Returns MAX_PROPERTIES_PER_LANDLORD if property not found
    /// @param _landlord Address of the landlord
    /// @param _propertyId ID of the property to find
    /// @return The index of the property in the landlord's array
    function _findPropertyIndex(
        address _landlord,
        uint16 _propertyId
    ) private view returns (uint16) {
        LimitedProperty storage landlordProps = landlordProperties[_landlord];

        for (uint16 i = 0; i < landlordProps.count; i++) {
            if (landlordProps.properties[i] == _propertyId) {
                return i;
            }
        }

        return MAX_PROPERTIES_PER_LANDLORD; // Property not found
    }

    /// @notice Gets all properties owned by a landlord
    /// @param _landlord Address of the landlord
    /// @return Array of property IDs owned by the landlord
    function getLandlordProperties(
        address _landlord
    ) external view returns (uint16[] memory) {
        LimitedProperty storage landlordProps = landlordProperties[_landlord];
        uint16[] memory result = new uint16[](landlordProps.count);

        for (uint16 i = 0; i < landlordProps.count; i++) {
            result[i] = landlordProps.properties[i];
        }

        return result;
    }

    /// @notice Gets all deposits associated with a tenant
    /// @param _tenant Address of the tenant
    /// @return Array of deposit IDs associated with the tenant
    function getTenantDeposits(
        address _tenant
    ) external view returns (uint256[] memory) {
        return tenantDeposits[_tenant];
    }

    /// @notice Gets all deposits associated with a property (historical)
    /// @param _propertyId ID of the property to query
    /// @return Array of deposit IDs associated with the property
    function getPropertyDeposits(
        uint256 _propertyId
    ) external view propertyExists(_propertyId) returns (uint256[] memory) {
        return propertyDeposits[_propertyId];
    }

    /// @notice Gets current active deposit ID for a property
    /// @param _propertyId ID of the property to query
    /// @return The ID of the current deposit (0 if none)
    function getDepositIdFromProperty(
        uint256 _propertyId
    ) external view propertyExists(_propertyId) returns (uint256) {
        return properties[_propertyId].currentDepositId;
    }

    /// @notice Gets details of a specific property
    /// @param _propertyId ID of the property to query
    /// @return Tuple containing all property details (id, landlord, name, location, status)
    function getPropertyDetails(
        uint256 _propertyId
    )
        external
        view
        propertyExists(_propertyId)
        returns (uint256, address, string memory, string memory, PropertyStatus)
    {
        Property storage property = properties[_propertyId];
        return (
            property.id,
            property.landlord,
            property.name,
            property.location,
            property.status
        );
    }

    /// @notice Gets details of a specific deposit
    /// @param _depositId ID of the deposit to query
    /// @return Tuple containing all deposit details
    function getDepositDetails(
        uint256 _depositId
    )
        external
        view
        depositExists(_depositId)
        returns (
            uint256,
            uint256,
            address,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            DepositStatus,
            string memory
        )
    {
        Deposit storage deposit = deposits[_depositId];
        return (
            deposit.id,
            deposit.propertyId,
            deposit.tenant,
            deposit.amount,
            deposit.finalAmount,
            deposit.creationDate,
            deposit.paymentDate,
            deposit.refundDate,
            deposit.status,
            deposit.depositCode
        );
    }

    /// @notice Gets details of a specific property
    /// @param _propertyId ID of the property to query
    /// @return Property struct containing all property details
    function getProperty(
        uint256 _propertyId
    ) external view propertyExists(_propertyId) returns (Property memory) {
        return properties[_propertyId];
    }

    /// @notice Gets details of a specific deposit
    /// @param _depositId ID of the deposit to query
    /// @return Deposit struct containing all deposit details
    function getDeposit(
        uint256 _depositId
    ) external view depositExists(_depositId) returns (Deposit memory) {
        return deposits[_depositId];
    }

    /// @notice Gets all files associated with a property
    /// @dev Returns files of all types for the specified property
    /// @param _propertyId ID of the property to query
    /// @return Array of FileReference structs containing file details
    function getPropertyFiles(
        uint256 _propertyId
    )
        external
        view
        propertyExists(_propertyId)
        returns (FileReference[] memory)
    {
        uint256 totalFiles = 0;
        for (uint i = 0; i < 4; i++) {
            totalFiles += propertyFiles[_propertyId][FileType(i)].length;
        }

        FileReference[] memory allFiles = new FileReference[](totalFiles);
        uint256 currentIndex = 0;

        for (uint i = 0; i < 4; i++) {
            FileReference[] storage filesOfType = propertyFiles[_propertyId][
                FileType(i)
            ];
            for (uint j = 0; j < filesOfType.length; j++) {
                allFiles[currentIndex] = filesOfType[j];
                currentIndex++;
            }
        }

        return allFiles;
    }
}
