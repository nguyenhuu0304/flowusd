// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title FlowUSD Swap
/// @notice A deliberately simple two-way exchange between USDC and a demo
///         token (FlowSwapToken), at a fixed rate the owner sets. This is
///         NOT an automated market maker — there is no price curve, no
///         liquidity pools, no external price feeds. That trade-off is
///         intentional: a fixed-rate exchange is far easier to reason
///         about and audit than a full AMM, which is the right choice for
///         a demo of on-chain swapping rather than a production DEX.
///
///         Reserves are simply this contract's own token balances — the
///         owner funds it by sending USDC/FST to the contract address
///         directly, the same way you'd fund any wallet.
contract FlowUSDSwap {
    address public immutable usdc;
    address public immutable token;
    address public owner;

    // Rate is "how many token units 1,000,000 USDC-units (i.e. 1 USDC) buys",
    // scaled by 1e6 for precision. Example: rate = 2_000_000 means 1 USDC
    // buys 2 FST (both tokens use 6 decimals in this app).
    uint256 public rate;

    event RateUpdated(uint256 newRate);
    event Swapped(
        address indexed user,
        bool usdcToToken,
        uint256 amountIn,
        uint256 amountOut
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor(address _usdc, address _token, uint256 initialRate) {
        require(initialRate > 0, "Rate must be > 0");

        usdc = _usdc;
        token = _token;
        owner = msg.sender;
        rate = initialRate;
    }

    /// @notice Update the fixed exchange rate. Owner-only so the demo rate
    ///         can be tuned without redeploying.
    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be > 0");
        rate = newRate;
        emit RateUpdated(newRate);
    }

    /// @notice Swap USDC for FST at the current fixed rate.
    ///         Requires prior approve() on the USDC contract.
    function swapUsdcForToken(uint256 usdcAmount) external {
        require(usdcAmount > 0, "Amount must be > 0");

        uint256 tokenAmount = (usdcAmount * rate) / 1e6;
        require(tokenAmount > 0, "Amount too small");
        require(
            IERC20(token).balanceOf(address(this)) >= tokenAmount,
            "Insufficient FST liquidity"
        );

        require(
            IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount),
            "USDC transferFrom failed"
        );
        require(
            IERC20(token).transfer(msg.sender, tokenAmount),
            "FST transfer failed"
        );

        emit Swapped(msg.sender, true, usdcAmount, tokenAmount);
    }

    /// @notice Swap FST back for USDC at the current fixed rate.
    ///         Requires prior approve() on the FST contract.
    function swapTokenForUsdc(uint256 tokenAmount) external {
        require(tokenAmount > 0, "Amount must be > 0");

        uint256 usdcAmount = (tokenAmount * 1e6) / rate;
        require(usdcAmount > 0, "Amount too small");
        require(
            IERC20(usdc).balanceOf(address(this)) >= usdcAmount,
            "Insufficient USDC liquidity"
        );

        require(
            IERC20(token).transferFrom(msg.sender, address(this), tokenAmount),
            "FST transferFrom failed"
        );
        require(
            IERC20(usdc).transfer(msg.sender, usdcAmount),
            "USDC transfer failed"
        );

        emit Swapped(msg.sender, false, tokenAmount, usdcAmount);
    }

    /// @notice Read current on-chain reserves, useful for the UI to show
    ///         "how much liquidity is available" before a swap is attempted.
    function getReserves() external view returns (uint256 usdcReserve, uint256 tokenReserve) {
        usdcReserve = IERC20(usdc).balanceOf(address(this));
        tokenReserve = IERC20(token).balanceOf(address(this));
    }
}
