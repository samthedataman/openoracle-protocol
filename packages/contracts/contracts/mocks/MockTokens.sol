// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing with 6 decimals
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _decimals = 6;
    
    constructor() ERC20("Mock USD Coin", "USDC") {
        // Mint 1 million USDC to deployer
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Faucet function for testing - anyone can mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Airdrop function for testing
     */
    function airdrop(address[] calldata recipients, uint256 amount) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amount);
        }
    }
}

/**
 * @title MockPYUSD
 * @dev Mock PayPal USD token for testing with 6 decimals
 */
contract MockPYUSD is ERC20, Ownable {
    uint8 private constant _decimals = 6;
    
    constructor() ERC20("Mock PayPal USD", "PYUSD") {
        // Mint 1 million PYUSD to deployer
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Faucet function for testing - anyone can mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Airdrop function for testing
     */
    function airdrop(address[] calldata recipients, uint256 amount) external {
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amount);
        }
    }
}

/**
 * @title MockDAI
 * @dev Mock DAI token for testing with 18 decimals
 */
contract MockDAI is ERC20, Ownable {
    constructor() ERC20("Mock Dai Stablecoin", "DAI") {
        // Mint 1 million DAI to deployer
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    /**
     * @dev Faucet function for testing - anyone can mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockUSDT
 * @dev Mock Tether USD token for testing with 6 decimals
 */
contract MockUSDT is ERC20, Ownable {
    uint8 private constant _decimals = 6;
    
    constructor() ERC20("Mock Tether USD", "USDT") {
        // Mint 1 million USDT to deployer
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Faucet function for testing - anyone can mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}