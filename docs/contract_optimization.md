# Documentation Technique - Smart Deposit : Gas Optimisations

## Optimisation du stockage (solidity)

- GasOptimizationTest.sol : un contrat pour tester les performances en fonction du storage
- GasOptimizationTest.test.ts : un script de test qui s'appuie sur hardhat-gas-reporter pour mesurer la consommation de gas

Je voulais vérifier si on pouvait optimiser les mappings de type : 
    mapping(address => uint256[]) private landlordProperties;
    mapping(address => uint256[]) private tenantDeposits;

en faisant par ex :
    mapping(address => LimitedProperty) private landlordProperties;

avec :
    struct LimitedProperty {
        uint256[1000] properties;
        uint256 count;
    }

On s'aperçoit qu'avec des uint256, les performances sont équivalentes entre un tableau dynamique et un tableau fixe.
Avec des stockages plus petits comme uint16 ou uint32 les coûts en gas diminuent, mais j'ai une incompatibilité fonctionnelle :
Il est logique de limiter le nb de biens par propriétaire ou le nb de cautions par locataire, mais comme ces tableaux vont contenir
des Ids de propriétés ou de cautions non limités (uint256).
En effet si SmartDeposit est un succès il pourrait y avoir des millions voire des milliards de propriétés ou de cautions... 
Une conversion uint16(propertyId) deviendrait dangereuse...

Bilan : je suis revenu à un tableau dynamique (qui est par ailleurs plus facile à manipuler).

·················································································································
|  Solidity and Network Configuration                                                                           │
····························|·················|···············|·················|································
|  Solidity: 0.8.28         ·  Optim: true    ·  Runs: 200    ·  viaIR: true    ·     Block: 30,000,000 gas     │
····························|·················|···············|·················|································
|  Methods                                                                                                      │
····························|·················|···············|·················|················|···············
|  Contracts / Methods      ·  Min            ·  Max          ·  Avg            ·  # calls       ·  usd (avg)   │
····························|·················|···············|·················|················|···············
|  GasOptimizationTest      ·                                                                                   │
····························|·················|···············|·················|················|···············
|      addPropertyDynamic   ·         48,881  ·       65,981  ·         48,941  ·          1002  ·           -  │
····························|·················|···············|·················|················|···············
|      addPropertyFixed256  ·         48,931  ·       66,031  ·         48,991  ·          1002  ·           -  │
····························|·················|···············|·················|················|···············
|      addPropertyFixed32   ·         31,927  ·       66,127  ·         34,154  ·          1002  ·           -  │
····························|·················|···············|·················|················|···············
|      addPropertyPacked    ·         34,268  ·       89,074  ·         36,477  ·          1002  ·           -  │
····························|·················|···············|·················|················|···············
|  Deployments                                ·                                 ·  % of limit    ·              │
····························|·················|···············|·················|················|···············
|  GasOptimizationTest      ·              -  ·            -  ·        440,046  ·         1.5 %  ·           -  │
····························|·················|···············|·················|················|···············
|  SmartDeposit             ·              -  ·            -  ·      2,101,663  ·           7 %  ·           -  │
····························|·················|···············|·················|················|···············
|  Key                                                                                                          │
·················································································································
|  ◯  Execution gas for this method does not include intrinsic gas overhead                                    │
·················································································································
|  △  Cost was non-zero but below the precision setting for the currency display (see options)                  │
·················································································································
|  Toolchain:  hardhat                                                                                          │
·················································································································