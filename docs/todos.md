# Active Codebase TODOs & Roadmap

## 1. Security Enhancements
- [ ] **Asymmetric JWT Signing**: Transition from HMAC-SHA256 (symmetric shared secret) to **RS256** or **ES256**. The Auth Service should hold the private key, while the API Gateway fetches public keys via a JWKS endpoint (`/api/auth/.well-known/jwks.json`).
- [ ] **Access & Refresh Tokens**: Implement short-lived Access Tokens stored in memory alongside long-lived Refresh Tokens (`HttpOnly` cookies) to prevent XSS and allow session revocation via Redis.

## 2. Infrastructure & Routing
- [ ] **Sticky Routing**: Implement Redis lookup for `game-service` instance pinning / sticky routing in the Gateway. If multiple game services exist, players of the same match must hit the same instance.
- [ ] **OAuth Integration**: Add Google OAuth client integration to the login and registration pages.

## 3. Game Lifecycle Resiliency
- [ ] **Auto-Start Clocks**: White's stats clock running automatically on game creation in `GameManager`. This should not be the case. A players clock should only start running after their first move. 
- [ ] **Server-Side Cleanup**: Implement auto-abort cleanup in `game-service` if a player fails to connect or make a move within the initial threshold.
- [ ] **Lazy Crash Recovery**: On WebSocket connection, if the game state is missing from RAM, lazily read and reconstruct the board state from the Redis move log.
- [ ] **Refactoring**: Refactor game-state mutation design pattern following the "Tell Don't Ask" principle.
