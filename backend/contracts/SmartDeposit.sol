// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";

contract SmartDeposit is Ownable {
    // Structs
    struct Property {
        uint256 id;
        uint256 depositId;
        address landlord;
        string name;
        string location;
        uint256 depositAmount;
        PropertyStatus status;
    }

    struct Deposit {
        uint256 id;
        uint256 propertyId;
        string depositCode;
        address tenant;
        uint256 amount;
        uint256 finalAmount;
        uint256 creationDate; // Date de création (PENDING)
        uint256 paymentDate; // Date de paiement (PAID)
        uint256 refundDate; // Date de remboursement (REFUNDED, PARTIALLY_REFUNDED, RETAINED)
        DepositStatus status;
    }

    // Structure simplifiée pour les fichiers IPFS
    struct FileReference {
        string cid; // Content ID sur IPFS
        uint256 uploadTimestamp; // Timestamp de l'upload
        FileType fileType; // Type de fichier
        address uploader; // Adresse de l'uploader
        string fileName; // Ajout du nom du fichier
    }

    enum FileType {
        LEASE,
        PHOTOS,
        ENTRY_INVENTORY,
        EXIT_INVENTORY
    }

    enum PropertyStatus {
        NOT_RENTED,
        RENTED,
        DISPUTED
    }
    enum DepositStatus {
        PENDING,
        PAID,
        DISPUTED,
        RETAINED,
        PARTIALLY_REFUNDED,
        REFUNDED
    }

    // State variables
    uint256 public propertyCounter;
    uint256 public depositCounter;
    mapping(uint256 => Property) private properties;
    mapping(uint256 => Deposit) private deposits;
    mapping(address => uint256[]) private landlordProperties;
    mapping(address => uint256[]) private tenantDeposits;

    // Mapping pour stocker les références aux fichiers
    mapping(uint256 => mapping(FileType => FileReference[]))
        private propertyFiles;

    // Events
    event PropertyCreated(
        uint256 indexed propertyId,
        address indexed landlord,
        string name,
        uint256 depositAmount,
        PropertyStatus status
    );
    event DepositMade(
        uint256 indexed depositId,
        uint256 indexed propertyId,
        address indexed tenant,
        uint256 amount
    );
    event DepositStatusChanged(uint256 indexed depositId, DepositStatus status);
    event DisputeRaised(uint256 indexed depositId, address indexed initiator);
    event DisputeResolved(
        uint256 indexed depositId,
        DepositStatus status,
        uint256 refundedAmount
    );
    event PropertyStatusChanged(
        uint256 indexed propertyId,
        PropertyStatus status
    );

    // Événement pour les fichiers
    event FileAdded(
        uint256 indexed propertyId,
        FileType indexed fileType,
        string cid,
        address indexed uploader
    );

    constructor() Ownable(msg.sender) {}

    // Modifiers
    modifier onlyLandlord(uint256 _propertyId) {
        require(
            properties[_propertyId].landlord == msg.sender,
            "Not the landlord"
        );
        _;
    }

    modifier onlyTenant(uint256 _depositId) {
        require(deposits[_depositId].tenant == msg.sender, "Not the tenant");
        _;
    }

    modifier propertyExists(uint256 _propertyId) {
        require(
            properties[_propertyId].id == _propertyId,
            "Property does not exist"
        );
        _;
    }

    modifier depositExists(uint256 _depositId) {
        require(
            deposits[_depositId].id == _depositId,
            "Deposit does not exist"
        );
        _;
    }

    // Prévoir un contrôle de volume de propriétés par propriétaire (réduire le risque de DDOS)
    function createProperty(
        string memory _name,
        string memory _location,
        uint256 _depositAmount
    ) external returns (uint256) {
        propertyCounter++;
        uint256 propertyId = propertyCounter;

        properties[propertyId] = Property({
            id: propertyId,
            depositId: 0,
            landlord: msg.sender,
            name: _name,
            location: _location,
            depositAmount: _depositAmount,
            status: PropertyStatus.NOT_RENTED
        });

        landlordProperties[msg.sender].push(propertyId);

        emit PropertyCreated(
            propertyId,
            msg.sender,
            _name,
            _depositAmount,
            PropertyStatus.NOT_RENTED
        );
        return propertyId;
    }

    function deleteProperty(
        uint256 _propertyId
    ) external propertyExists(_propertyId) onlyLandlord(_propertyId) {
        Property storage property = properties[_propertyId];

        require(
            property.status == PropertyStatus.NOT_RENTED,
            "Property is rented"
        );
        require(
            property.status != PropertyStatus.DISPUTED,
            "Property is disputed"
        );

        // Supprime le bien du tableau des biens du propriétaire en faisant un
        // parcours de la liste des biens du propriétaire (cette liste n'aura jamais un grand nombre d'éléments)
        uint256[] storage landlordProps = landlordProperties[msg.sender];
        for (uint i = 0; i < landlordProps.length; i++) {
            if (landlordProps[i] == _propertyId) {
                landlordProps[i] = landlordProps[landlordProps.length - 1];
                landlordProps.pop();
                break;
            }
        }

        // Supprime le bien de la cartographie des biens
        delete properties[_propertyId];

        emit PropertyStatusChanged(_propertyId, PropertyStatus.NOT_RENTED);
    }

    // Événements pour le suivi des dépôts
    event DepositCreated(
        uint256 indexed depositId,
        uint256 indexed propertyId,
        uint256 amount,
        string depositCode
    );
    event DepositPaid(
        uint256 indexed depositId,
        address indexed tenant,
        uint256 amount
    );

    function createDeposit(
        uint256 _propertyId,
        string memory _depositCode
    )
        external
        propertyExists(_propertyId)
        onlyLandlord(_propertyId)
        returns (uint256)
    {
        Property storage property = properties[_propertyId];
        require(
            property.status == PropertyStatus.NOT_RENTED,
            "Property already rented"
        );
        require(property.depositId == 0, "Deposit already exists");
        require(bytes(_depositCode).length > 0, "Invalid deposit code");

        depositCounter++;
        uint256 depositId = depositCounter;

        deposits[depositId] = Deposit({
            id: depositId,
            propertyId: _propertyId,
            tenant: address(0), // Sera défini lors du paiement
            amount: property.depositAmount,
            finalAmount: 0,
            creationDate: block.timestamp,
            paymentDate: 0,
            refundDate: 0,
            status: DepositStatus.PENDING,
            depositCode: _depositCode
        });

        properties[_propertyId].depositId = depositId;

        emit DepositCreated(
            depositId,
            _propertyId,
            property.depositAmount,
            _depositCode
        );

        return depositId;
    }

    function payDeposit(
        uint256 _depositId,
        string memory _depositCode
    ) external payable depositExists(_depositId) {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.PENDING, "Deposit not pending");
        require(
            keccak256(abi.encodePacked(deposit.depositCode)) ==
                keccak256(abi.encodePacked(_depositCode)),
            "Invalid deposit code"
        );
        require(msg.value == deposit.amount, "Incorrect deposit amount");
        require(deposit.tenant == address(0), "Deposit already has tenant");

        deposit.tenant = msg.sender;
        deposit.status = DepositStatus.PAID;
        deposit.paymentDate = block.timestamp; // Enregistrement de la date de paiement
        properties[deposit.propertyId].status = PropertyStatus.RENTED;
        tenantDeposits[msg.sender].push(_depositId);

        emit DepositPaid(_depositId, msg.sender, msg.value);
        emit PropertyStatusChanged(deposit.propertyId, PropertyStatus.RENTED);
    }

    function initiateDispute(
        uint256 _depositId
    )
        external
        depositExists(_depositId)
        onlyLandlord(deposits[_depositId].propertyId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.PAID, "Deposit not paid");

        Property storage property = properties[deposit.propertyId];
        require(
            property.status == PropertyStatus.RENTED,
            "Property not rented"
        );

        property.status = PropertyStatus.DISPUTED;
        deposit.status = DepositStatus.DISPUTED;

        emit DisputeRaised(_depositId, msg.sender);
        emit DepositStatusChanged(_depositId, DepositStatus.DISPUTED);
        emit PropertyStatusChanged(deposit.propertyId, PropertyStatus.DISPUTED);
    }

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

        require(
            _refundedAmount <= deposit.amount,
            "Tenant deposit amount is greater than the deposit amount"
        );

        Property storage property = properties[deposit.propertyId];
        property.status = PropertyStatus.NOT_RENTED;

        // Enregistrer la date de remboursement
        deposit.refundDate = block.timestamp;

        // refund, partially refund or retain the deposit
        if (_refundedAmount == deposit.amount) {
            deposit.status = DepositStatus.REFUNDED;
            deposit.finalAmount = deposit.amount;
            payable(deposit.tenant).transfer(deposit.amount);
        } else if (
            (_refundedAmount > 0) && (_refundedAmount < deposit.amount)
        ) {
            deposit.status = DepositStatus.PARTIALLY_REFUNDED;
            deposit.finalAmount = _refundedAmount;
            payable(properties[deposit.propertyId].landlord).transfer(
                deposit.amount - _refundedAmount
            );
            payable(deposit.tenant).transfer(_refundedAmount);
        } else {
            deposit.status = DepositStatus.RETAINED;
            deposit.finalAmount = 0;
            payable(properties[deposit.propertyId].landlord).transfer(
                deposit.amount
            );
        }

        emit DisputeResolved(_depositId, deposit.status, _refundedAmount);
        emit DepositStatusChanged(_depositId, deposit.status);
        emit PropertyStatusChanged(
            deposit.propertyId,
            PropertyStatus.NOT_RENTED
        );
    }

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

    // Fonction pour ajouter un fichier (bail ou photos)
    function addFile(
        uint256 _propertyId,
        string memory _cid,
        FileType _fileType,
        string memory _fileName
    ) external propertyExists(_propertyId) onlyLandlord(_propertyId) {
        FileReference memory newFile = FileReference({
            cid: _cid,
            uploadTimestamp: block.timestamp,
            fileType: _fileType,
            uploader: msg.sender,
            fileName: _fileName
        });

        propertyFiles[_propertyId][_fileType].push(newFile);

        emit FileAdded(_propertyId, _fileType, _cid, msg.sender);
    }

    // View functions
    function getLandlordProperties(
        address _landlord
    ) external view returns (uint256[] memory) {
        return landlordProperties[_landlord];
    }

    function getTenantDeposits(
        address _tenant
    ) external view returns (uint256[] memory) {
        return tenantDeposits[_tenant];
    }

    function getPropertyDetails(
        uint256 _propertyId
    )
        external
        view
        propertyExists(_propertyId)
        returns (
            uint256 id,
            address landlord,
            string memory name,
            string memory location,
            uint256 depositAmount,
            PropertyStatus status
        )
    {
        Property storage property = properties[_propertyId];
        return (
            property.id,
            property.landlord,
            property.name,
            property.location,
            property.depositAmount,
            property.status
        );
    }

    function getDepositIdFromProperty(
        uint256 _propertyId
    ) external view returns (uint256) {
        return properties[_propertyId].depositId;
    }

    function getPropertyIdFromDeposit(
        uint256 _depositId
    ) external view returns (uint256) {
        return deposits[_depositId].propertyId;
    }

    function getDepositDetails(
        uint256 _depositId
    )
        external
        view
        depositExists(_depositId)
        returns (
            uint256 id,
            uint256 propertyId,
            address tenant,
            uint256 amount,
            uint256 finalAmount,
            uint256 creationDate,
            uint256 paymentDate,
            uint256 refundDate,
            DepositStatus status,
            string memory depositCode
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

    // Fonction pour récupérer tous les fichiers d'une propriété
    function getPropertyFiles(
        uint256 _propertyId
    )
        external
        view
        propertyExists(_propertyId)
        returns (FileReference[] memory)
    {
        // Créer un tableau temporaire pour stocker tous les fichiers
        uint256 totalFiles = 0;
        for (uint256 i = 0; i < 4; i++) {
            totalFiles += propertyFiles[_propertyId][FileType(i)].length;
        }

        FileReference[] memory allFiles = new FileReference[](totalFiles);
        uint256 currentIndex = 0;

        // Copier tous les fichiers dans le tableau
        for (uint256 i = 0; i < 4; i++) {
            FileReference[] storage filesOfType = propertyFiles[_propertyId][
                FileType(i)
            ];
            for (uint256 j = 0; j < filesOfType.length; j++) {
                allFiles[currentIndex] = filesOfType[j];
                currentIndex++;
            }
        }

        return allFiles;
    }
}
