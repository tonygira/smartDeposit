// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import "@openzeppelin/contracts/access/Ownable.sol";

contract SmartDeposit is Ownable {
    // Structs
    struct Property {
        uint256 id;
        address landlord;
        string name;
        string location;
        uint256 depositAmount;
        PropertyStatus status;
    }

    struct Deposit {
        uint256 id;
        uint256 propertyId;
        address tenant;
        uint256 amount;
        uint256 timestamp;
        DepositStatus status;
    }

    enum PropertyStatus {
        NOT_RENTED,
        RENTED,
        DISPUTED
    }
    enum DepositStatus {
        PENDING,
        ACTIVE,
        DISPUTED,
        RETAINED,
        REFUNDED
    }

    // State variables
    uint256 public propertyCounter;
    uint256 public depositCounter;
    mapping(uint256 => Property) private properties;
    mapping(uint256 => Deposit) private deposits;
    mapping(address => uint256[]) private landlordProperties;
    mapping(address => uint256[]) private tenantDeposits;

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
    event DisputeResolved(uint256 indexed depositId, bool favorTenant);
    event PropertyStatusChanged(
        uint256 indexed propertyId,
        PropertyStatus status
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

    // Functions
    function createProperty(
        string memory _name,
        string memory _location,
        uint256 _depositAmount
    ) external returns (uint256) {
        propertyCounter++;
        uint256 propertyId = propertyCounter;

        properties[propertyId] = Property({
            id: propertyId,
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
    ) external propertyExists(_propertyId) {
        Property storage property = properties[_propertyId];

        require(msg.sender == property.landlord, "Not the landlord");
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

    function makeDeposit(
        uint256 _propertyId
    ) external payable propertyExists(_propertyId) returns (uint256) {
        Property storage property = properties[_propertyId];
        require(
            msg.value == property.depositAmount,
            "Incorrect deposit amount"
        );

        depositCounter++;
        uint256 depositId = depositCounter;

        deposits[depositId] = Deposit({
            id: depositId,
            propertyId: _propertyId,
            tenant: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            status: DepositStatus.ACTIVE
        });

        tenantDeposits[msg.sender].push(depositId);

        emit DepositMade(depositId, _propertyId, msg.sender, msg.value);

        emit PropertyStatusChanged(_propertyId, PropertyStatus.RENTED);
        properties[_propertyId].status = PropertyStatus.RENTED;

        return depositId;
    }

    function initiateDispute(
        uint256 _depositId
    )
        external
        onlyLandlord(deposits[_depositId].propertyId)
        depositExists(_depositId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.ACTIVE, "Deposit not active");

        deposit.status = DepositStatus.DISPUTED;

        emit DisputeRaised(_depositId, msg.sender);
        emit DepositStatusChanged(_depositId, DepositStatus.DISPUTED);
    }

    function resolveDispute(
        uint256 _depositId,
        bool _favorTenant
    )
        external
        onlyLandlord(deposits[_depositId].propertyId)
        depositExists(_depositId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(
            deposit.status == DepositStatus.DISPUTED,
            "Deposit not disputed"
        );

        if (_favorTenant) {
            deposit.status = DepositStatus.REFUNDED;
            payable(deposit.tenant).transfer(deposit.amount);
        } else {
            deposit.status = DepositStatus.RETAINED;
            payable(properties[deposit.propertyId].landlord).transfer(
                deposit.amount
            );
        }

        emit DisputeResolved(_depositId, _favorTenant);
        emit DepositStatusChanged(_depositId, deposit.status);
    }

    function retainDeposit(
        uint256 _depositId
    )
        external
        onlyLandlord(deposits[_depositId].propertyId)
        depositExists(_depositId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.ACTIVE, "Deposit not active");

        deposit.status = DepositStatus.RETAINED;
        Property storage property = properties[deposits[_depositId].propertyId];
        property.status = PropertyStatus.NOT_RENTED;

        payable(msg.sender).transfer(deposit.amount);

        emit DepositStatusChanged(_depositId, DepositStatus.RETAINED);
        emit PropertyStatusChanged(_depositId, PropertyStatus.NOT_RENTED);
    }

    function refundDeposit(
        uint256 _depositId
    )
        external
        onlyLandlord(deposits[_depositId].propertyId)
        depositExists(_depositId)
    {
        Deposit storage deposit = deposits[_depositId];
        require(deposit.status == DepositStatus.ACTIVE, "Deposit not active");

        deposit.status = DepositStatus.REFUNDED;
        Property storage property = properties[deposits[_depositId].propertyId];
        property.status = PropertyStatus.NOT_RENTED;

        payable(deposit.tenant).transfer(deposit.amount);

        emit DepositStatusChanged(_depositId, DepositStatus.REFUNDED);
        emit PropertyStatusChanged(_depositId, PropertyStatus.NOT_RENTED);
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
            uint256 timestamp,
            DepositStatus status
        )
    {
        Deposit storage deposit = deposits[_depositId];
        return (
            deposit.id,
            deposit.propertyId,
            deposit.tenant,
            deposit.amount,
            deposit.timestamp,
            deposit.status
        );
    }
}
