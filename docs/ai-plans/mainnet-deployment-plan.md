# Mainnet Deployment Plan

## Objective and Success Criteria

### Objective
Deploy the complete cross-chain swap protocol to mainnet on both Ethereum and Stellar networks, with full integration to 1inch Fusion+ infrastructure, demonstrating production readiness with robust security, monitoring, and operational procedures.

### Success Criteria
- [ ] Smart contracts deployed and verified on Ethereum mainnet
- [ ] Soroban contracts deployed on Stellar mainnet
- [ ] Frontend hosted on production infrastructure
- [ ] Resolver service running with high availability
- [ ] Full integration with 1inch Fusion+ network
- [ ] KYC/whitelisting completed for resolver status
- [ ] Monitoring and alerting systems operational
- [ ] Security audit completed or in progress
- [ ] Disaster recovery plan implemented
- [ ] Successfully process 10+ mainnet swaps through 1inch

## Tasks

### [ ] Main Task 1: Pre-deployment Security Review
  - [ ] Subtask 1.1: Internal security audit
    - [ ] Review all smart contract code
    - [ ] Check for common vulnerabilities
    - [ ] Validate access controls
    - [ ] Test edge cases thoroughly
  - [ ] Subtask 1.2: External audit preparation
    - [ ] Prepare audit documentation
    - [ ] Create threat model
    - [ ] Document all assumptions
    - [ ] Schedule audit (if time permits)
  - [ ] Subtask 1.3: Bug bounty setup
    - [ ] Define scope and rewards
    - [ ] Create security policy
    - [ ] Set up responsible disclosure

### [ ] Main Task 2: Infrastructure Setup
  - [ ] Subtask 2.1: Production environment
    - [ ] Set up production AWS/Vercel account
    - [ ] Configure domain and SSL certificates
    - [ ] Set up CDN for static assets
    - [ ] Configure DDoS protection
  - [ ] Subtask 2.2: Database and caching
    - [ ] Deploy production database (PostgreSQL)
    - [ ] Set up Redis for caching
    - [ ] Configure automated backups
    - [ ] Set up read replicas
  - [ ] Subtask 2.3: Monitoring infrastructure
    - [ ] Deploy Grafana dashboards
    - [ ] Set up Prometheus metrics
    - [ ] Configure log aggregation
    - [ ] Create alerting rules

### [ ] Main Task 3: Ethereum Mainnet Deployment
  - [ ] Subtask 3.1: Contract deployment preparation
    - [ ] Fund deployment wallet with ETH
    - [ ] Calculate optimal gas prices
    - [ ] Prepare deployment scripts
    - [ ] Test on Ethereum Sepolia first
  - [ ] Subtask 3.2: Deploy contracts
    - [ ] Deploy resolver contract
    - [ ] Configure escrow factory
    - [ ] Set up multisig admin
    - [ ] Verify contracts on Etherscan
  - [ ] Subtask 3.3: Post-deployment setup
    - [ ] Transfer ownership to multisig
    - [ ] Configure protocol parameters
    - [ ] Test with small amounts
    - [ ] Document contract addresses

### [ ] Main Task 4: Stellar Mainnet Deployment
  - [ ] Subtask 4.1: Soroban deployment prep
    - [ ] Fund Stellar account with XLM
    - [ ] Build optimized WASM contracts
    - [ ] Prepare deployment CLI commands
    - [ ] Test on Stellar testnet
  - [ ] Subtask 4.2: Deploy Soroban contracts
    - [ ] Deploy escrow contract
    - [ ] Initialize contract state
    - [ ] Set up admin keys
    - [ ] Submit to Stellar Expert
  - [ ] Subtask 4.3: Integration testing
    - [ ] Test XLM transfers
    - [ ] Test USDC transfers
    - [ ] Verify event emission
    - [ ] Confirm resolver compatibility

### [ ] Main Task 5: Resolver Service Deployment
  - [ ] Subtask 5.1: High availability setup
    - [ ] Deploy to multiple regions
    - [ ] Configure load balancer
    - [ ] Set up failover mechanism
    - [ ] Implement health checks
  - [ ] Subtask 5.2: Security hardening
    - [ ] Secure private keys in HSM/KMS
    - [ ] Implement rate limiting
    - [ ] Add request authentication
    - [ ] Set up firewall rules
  - [ ] Subtask 5.3: 1inch Integration
    - [ ] Complete KYC/whitelisting process
    - [ ] Connect to 1inch order broadcast
    - [ ] Integrate with 1inch relayer
    - [ ] Configure resolver parameters
  - [ ] Subtask 5.4: Operational procedures
    - [ ] Create runbooks
    - [ ] Set up on-call rotation
    - [ ] Document escalation procedures
    - [ ] Implement automated responses

### [ ] Main Task 6: Frontend Production Deployment
  - [ ] Subtask 6.1: Build optimization
    - [ ] Minimize bundle size
    - [ ] Implement code splitting
    - [ ] Optimize images and assets
    - [ ] Enable compression
  - [ ] Subtask 6.2: Deployment pipeline
    - [ ] Set up CI/CD with GitHub Actions
    - [ ] Configure staging environment
    - [ ] Implement blue-green deployment
    - [ ] Add rollback capability
  - [ ] Subtask 6.3: Performance monitoring
    - [ ] Set up Real User Monitoring
    - [ ] Configure error tracking (Sentry)
    - [ ] Monitor Core Web Vitals
    - [ ] Set up uptime monitoring

### [ ] Main Task 7: Operational Readiness
  - [ ] Subtask 7.1: Documentation
    - [ ] Create user documentation
    - [ ] Write troubleshooting guides
    - [ ] Document API endpoints
    - [ ] Prepare FAQs
  - [ ] Subtask 7.2: Support infrastructure
    - [ ] Set up support channels
    - [ ] Create ticket system
    - [ ] Prepare response templates
    - [ ] Train support team
  - [ ] Subtask 7.3: Launch preparation
    - [ ] Create launch checklist
    - [ ] Prepare announcement posts
    - [ ] Set up analytics tracking
    - [ ] Plan soft launch strategy

## Technical Considerations

### 1inch Integration Requirements
1. **Resolver Registration**: Complete KYC/KYB process with 1inch
2. **API Access**: Obtain production API keys from Developer Portal
3. **Order Format**: Ensure compatibility with Fusion+ order structure
4. **Network Connection**: Establish WebSocket connection to order stream
5. **Compliance**: Meet all 1inch resolver requirements

### Security Requirements
1. **Private Key Management**: Use AWS KMS or similar for resolver keys
2. **Access Control**: Implement role-based access with principle of least privilege
3. **Audit Trail**: Log all critical operations with immutable storage
4. **Incident Response**: Have clear procedures for security incidents
5. **Backup Strategy**: Regular backups with tested restore procedures

### Performance Requirements
1. **Latency**: <100ms API response time at p95
2. **Throughput**: Handle 100+ swaps per minute
3. **Availability**: 99.9% uptime SLA
4. **Scalability**: Auto-scaling based on load
5. **Recovery**: RTO < 1 hour, RPO < 5 minutes

### Compliance Considerations
1. **Terms of Service**: Clear terms for mainnet usage
2. **Privacy Policy**: GDPR-compliant data handling
3. **Geo-restrictions**: Block sanctioned regions
4. **KYC/AML**: Consider requirements for large swaps
5. **Disclaimer**: Clear risk warnings for users

## Files That Will Be Affected

### Deployment Scripts
- `scripts/deploy/` - Deployment automation
  - `ethereum-mainnet.ts` - Ethereum deployment
  - `stellar-mainnet.ts` - Stellar deployment
  - `verify-contracts.ts` - Contract verification
  - `post-deploy-config.ts` - Configuration script

### Configuration Files
- `.env.production` - Production environment variables
- `infrastructure/` - IaC configurations
  - `terraform/` - Infrastructure as Code
  - `k8s/` - Kubernetes manifests
  - `docker/` - Container definitions

### Monitoring Configuration
- `monitoring/` - Monitoring setup
  - `grafana/` - Dashboard definitions
  - `prometheus/` - Metrics configuration
  - `alerts/` - Alert rules

### Documentation Updates
- `docs/mainnet/` - Mainnet documentation
  - `addresses.md` - Contract addresses
  - `runbooks.md` - Operational procedures
  - `security.md` - Security procedures
  - `troubleshooting.md` - Common issues

## Dependencies

### Infrastructure Tools
```json
{
  "terraform": "^1.6.0",
  "kubernetes": "^1.28.0",
  "docker": "^24.0.0",
  "github-actions": "latest"
}
```

### Monitoring Tools
```yaml
services:
  - prometheus: "2.47.0"
  - grafana: "10.2.0"
  - elasticsearch: "8.11.0"
  - kibana: "8.11.0"
```

### Security Tools
```json
{
  "slither": "^0.10.0",
  "mythril": "^0.23.0",
  "echidna": "^2.2.0",
  "tenderly": "latest"
}
```

## Risk Mitigation

1. **Deployment Failures**: Test thoroughly on testnet, have rollback plan
2. **Security Vulnerabilities**: Conduct audit, implement bug bounty
3. **Performance Issues**: Load test before launch, have scaling plan
4. **Operational Errors**: Automate everything possible, clear runbooks
5. **Fund Loss**: Start with limits, gradually increase as confidence grows 