// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract GasOptimizationTest {
    // Approche 1: uint256[] classique
    mapping(address => uint256[]) private landlordProperties;
    
    // Approche 2: uint32[1000] tableau fixe
    struct LimitedArray {
        uint32[1000] properties;
        uint32 count;
    }
    mapping(address => LimitedArray) private landlordPropertiesFixed;
    
    // Approche 3: bytes32[] avec encodage (10 IDs par slot)
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
    function addPropertyFixed(uint32 _propertyId) external {
        LimitedArray storage lp = landlordPropertiesFixed[msg.sender];
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
    function getPropertiesFixed() external view returns (uint32[] memory) {
        LimitedArray storage lp = landlordPropertiesFixed[msg.sender];
        uint32[] memory result = new uint32[](lp.count);
        for (uint32 i = 0; i < lp.count; i++) {
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
