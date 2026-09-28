# FlowUSD Change Log

## 2026-09-28 — Merchant Analytics

- Added `/analytics` protected route.
- Added Merchant Analytics dashboard with:
  - total completed payment volume
  - incoming and outgoing USDC
  - net flow
  - transaction success rate
  - six-month payment-volume trend
  - monthly incoming vs outgoing chart
  - top counterparties by completed volume
- Added Analytics to the main sidebar.
- Connected the Dashboard "View Analytics" quick action to the new route.
- Updated README feature list and roadmap to reflect Analytics completion.
- Removed the outdated README statement that Arc was waiting for Mainnet after a testnet reset; custom FlowUSD contracts remain disabled until fresh deployed addresses are configured.
