// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract GasOptimizationTest {
    // Approche 1: uint256[] classique
    mapping(address => uint256[]) private landlordProperties;
    
    // Approche 2: uint32[1000] tableau fixe
    struct LimitedArray32 {
        uint32[1000] properties;
        uint32 count;
    }

    // Approche 3: uint256[1000] tableau fixe
    struct LimitedArray256 {
        uint256[1000] properties;
        uint256 count;
    }

    mapping(address => LimitedArray32) private landlordPropertiesFixed32;
    mapping(address => LimitedArray256) private landlordPropertiesFixed256;
    

    // Approche 4: bytes32[] avec encodage (10 IDs par slot)
    struct PropertyStorage {
        bytes32[] packedProperties;
        uint256 count;
    }
    mapping(address => PropertyStorage) private landlordPropertiesPacked;

    // Ajout pour uint256[] classique
    function addPropertyDynamic(uint256 _propertyId) external {
        landlordProperties[msg.sender].push(_propertyId);
    }
    
    // Ajout pour uint32[1000] fixe
    function addPropertyFixed32(uint32 _propertyId) external {
        LimitedArray32 storage lp = landlordPropertiesFixed32[msg.sender];
        require(lp.count < 1000, "Max properties reached");
        lp.properties[lp.count] = _propertyId;
        lp.count++;
    }

    function addPropertyFixed256(uint256 _propertyId) external {
        LimitedArray256 storage lp = landlordPropertiesFixed256[msg.sender];
        require(lp.count < 1000, "Max properties reached");
        lp.properties[lp.count] = _propertyId;
        lp.count++;
    }
    
    // Ajout pour bytes32[] avec encodage
    function addPropertyPacked(uint24 _propertyId) external {
        PropertyStorage storage ps = landlordPropertiesPacked[msg.sender];
        require(ps.count < 1000, "Max properties reached");
        if (ps.count % 10 == 0) {
            ps.packedProperties.push(0);
        }
        uint256 index = ps.count / 10;
        uint256 shift = (ps.count % 10) * 24;
        ps.packedProperties[index] |= bytes32(uint256(_propertyId) << shift);
        ps.count++;
    }
    
    // Lecture pour uint256[] classique
    function getPropertiesDynamic() external view returns (uint256[] memory) {
        return landlordProperties[msg.sender];
    }
    
    // Lecture pour uint32[1000] fixe
    function getPropertiesFixed32() external view returns (uint32[] memory) {
        LimitedArray32 storage lp = landlordPropertiesFixed32[msg.sender];
        uint32[] memory result = new uint32[](lp.count);
        for (uint32 i = 0; i < lp.count; i++) {
            result[i] = lp.properties[i];
        }
        return result;
    }

    // Lecture pour uint256[1000] fixe
    function getPropertiesFixed256() external view returns (uint256[] memory) {
        LimitedArray256 storage lp = landlordPropertiesFixed256[msg.sender];
        uint256[] memory result = new uint256[](lp.count);
        for (uint256 i = 0; i < lp.count; i++) {
            result[i] = lp.properties[i];
        }
        return result;
    }

    // Lecture pour bytes32[] avec encodage
    function getPropertiesPacked() external view returns (uint24[] memory) {
        PropertyStorage storage ps = landlordPropertiesPacked[msg.sender];
        uint24[] memory result = new uint24[](ps.count);
        for (uint256 i = 0; i < ps.count; i++) {
            uint256 index = i / 10;
            uint256 shift = (i % 10) * 24;
            result[i] = uint24(uint256(ps.packedProperties[index] >> shift));
        }
        return result;
    }
}
