# Procuvex Security Posture Document

**Version:** 1.0  
**Last Updated:** May 2025  
**Owner:** Core314 Technologies LLC  
**Classification:** Internal / Customer-Facing (upon request)

---

## 1. Executive Summary

Procuvex is a cloud-native procurement intelligence platform that processes sensitive government and commercial bid data. This document describes our security controls, data protection measures, and compliance posture.

---

## 2. Data Encryption

### In Transit
- All data transmitted between users and the platform is encrypted using **TLS 1.2+** (HTTPS enforced at CDN and API layers)
- API calls to third-party services (OpenAI, SendGrid, SAM.gov) use encrypted HTTPS connections
- Database connections use encrypted SSL/TLS tunnels

### At Rest
- PostgreSQL database encryption at rest via **AES-256** (managed by Supabase, which uses AWS infrastructure with encrypted EBS volumes)
- File storage (uploaded documents) encrypted at rest via S3 server-side encryption (SSE-S3, AES-256)
- Backups are encrypted using the same AES-256 standard

---

## 3. Access Controls

### Authentication
- User authentication handled via Supabase Auth (built on GoTrue)
- Passwords hashed using **bcrypt** with salt
- Session tokens are JWTs with configurable expiry
- Email verification required for account activation

### Authorization
- **Row-Level Security (RLS)** policies on all database tables enforce tenant isolation
- Users can only access data belonging to their organization (`org_id` filtering)
- Role-based access: Owner, Admin, Member, Viewer — each with different permission levels
- API endpoints validate JWT tokens and org membership before returning data

### Multi-Tenancy
- Complete tenant isolation via PostgreSQL RLS policies
- Each organization's data is logically separated at the database level
- No shared data between organizations — cross-tenant access is architecturally impossible when RLS is active

---

## 4. Data Isolation

### Tenant Separation
- Every data table includes an `org_id` column linked to the owning organization
- RLS policies enforce: `SELECT/INSERT/UPDATE/DELETE WHERE org_id = (SELECT current_org_id FROM user_profiles WHERE id = auth.uid())`
- Even if an API bug exists, the database layer prevents cross-tenant data leakage

### AI Processing
- Document analysis is performed per-request; no persistent AI memory across organizations
- AI prompts include only the requesting organization's data
- No training on customer data — OpenAI API used in zero-retention mode

---

## 5. Infrastructure

### Hosting
- **Application:** Netlify (CDN-backed, DDoS protection included, automatic HTTPS)
- **Database:** Supabase (PostgreSQL on AWS, managed backups, point-in-time recovery)
- **DNS/CDN:** Netlify Edge with global PoPs

### Availability
- Supabase Pro guarantees 99.9% uptime SLA
- Netlify provides 99.99% uptime SLA on their CDN
- Health monitoring via UptimeRobot (5-minute intervals)

### Backups
- Daily automated backups (Supabase Pro)
- Point-in-time recovery available (7-day window)
- Backup encryption matches production encryption standards

---

## 6. Data Retention & Deletion

### Retention
- Active account data retained for the duration of the subscription
- Audit logs retained for 7 years (compliance with federal record-keeping requirements)
- Deleted account data purged within 30 days of account closure

### Data Portability
- Full account export available in JSON and CSV formats
- Export includes: projects, subcontractors, documents metadata, quotes, AI outputs, team data
- Users can request export at any time via Settings > Billing > Export Data

### Right to Deletion
- Users may request complete data deletion by contacting support
- Deletion is performed within 30 days and includes all backup references
- Confirmation email sent upon completion of deletion

---

## 7. Incident Response

### Severity Levels
- **Critical:** Data breach, unauthorized access to customer data
- **High:** Service outage, data corruption
- **Medium:** Performance degradation, minor security vulnerability
- **Low:** Non-security bugs, cosmetic issues

### Response Timeline
| Severity | Detection | Initial Response | Resolution Target |
|----------|-----------|-----------------|-------------------|
| Critical | Immediate (automated alerts) | 1 hour | 4 hours |
| High | Within 15 minutes | 2 hours | 8 hours |
| Medium | Within 1 hour | 24 hours | 72 hours |
| Low | Within 24 hours | 48 hours | Next release |

### Breach Notification
- Affected customers notified within **72 hours** of confirmed breach
- Notification includes: nature of breach, data affected, remediation steps taken, contact for questions
- Regulatory bodies notified as required by applicable law

---

## 8. Vulnerability Management

### Code Security
- All code maintained in private Git repositories
- Dependencies automatically scanned for known vulnerabilities (npm audit)
- Third-party libraries reviewed before adoption

### Penetration Testing
- Planned for Q3 2025 (third-party engagement)
- Internal security review performed quarterly

### Responsible Disclosure
- Security issues can be reported to: security@procuvex.com
- Response within 48 hours
- No legal action against good-faith security researchers

---

## 9. Personnel Security

### Access Principles
- Principle of least privilege applied to all system access
- Production database access limited to service accounts and authorized operators
- No shared credentials — individual accounts with audit trails

### Third-Party Services
| Service | Purpose | Data Access | Compliance |
|---------|---------|-------------|------------|
| Supabase | Database & Auth | Full data store | SOC 2 Type II |
| Netlify | Hosting & CDN | Application code only | SOC 2 Type II |
| OpenAI | AI Analysis | Document text (per-request, no retention) | SOC 2 Type II |
| SendGrid | Email Delivery | Email addresses, message content | SOC 2 Type II |

---

## 10. Compliance Roadmap

### Current Status
- [x] Encryption at rest and in transit (AES-256, TLS 1.2+)
- [x] Row-Level Security for tenant isolation
- [x] Role-based access control
- [x] Automated backups with encryption
- [x] Data export and portability
- [x] Incident response plan documented
- [x] Security posture document (this document)

### Planned
- [ ] SOC 2 Type II audit (when revenue supports engagement)
- [ ] Annual third-party penetration test
- [ ] Security awareness training program
- [ ] Formal change management process documentation
- [ ] Business continuity plan (BCP/DR)

---

## 11. Contact

For security inquiries, vulnerability reports, or data deletion requests:

- **Email:** security@procuvex.com
- **Support:** admin@core314.com
- **Response SLA:** 48 hours for security inquiries, 24 hours for active incidents

---

*This document is reviewed and updated quarterly. Last review: May 2025.*
