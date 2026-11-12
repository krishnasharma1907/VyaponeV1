# VyapOne — Workspaces and Membership Roles Architecture

**Document Version:** 1.0.0  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§4, §15, §16, §17)  
**Related Task:** `VO-022`  
**Related ADRs:** ADR-002, ADR-003  

---

## 1. Tenancy Architecture & Sovereign Ownership Boundary

VyapOne enforces a strict multi-tenant hierarchy designed to protect merchant sovereignty while enabling high-efficiency agency and DIY operations:

```
Platform (Global Infrastructure & Guardrails)
   └── Reseller Workspace (Agency / DIY Management Scope)
         └── Business (Sovereign Merchant Entity — sovereign_owner_id)
               └── Location (Physical Store / Fulfillment Unit)
```

### Sovereign Ownership Invariant
- **Reseller Workspace Membership** (`public.workspace_members`) provides administrative tools to manage client businesses, provision websites, and manage team members.
- **Sovereign Business Ownership** (`public.businesses.sovereign_owner_id`) belongs strictly to the merchant entity.
- A workspace member, even a `workspace_owner`, does **not** automatically possess sovereign business ownership over client merchants. Sovereign business data ownership is legally and technically isolated.

---

## 2. Workspace Roles and Permission Model

### Canonical Roles & Legacy Compatibility
VyapOne standardizes on three canonical workspace roles, while transparently supporting existing schema identifiers for backward compatibility:

| Canonical Role | Legacy Synonyms | Rank | Description |
| :--- | :--- | :---: | :--- |
| `workspace_owner` | — | 30 | Creator and sole/primary owner of the agency workspace. Full access to workspace profile, billing, deletion, and team governance. |
| `workspace_admin` | `reseller_admin` | 20 | Operational administrator. Can manage client businesses, invite and remove members. Prohibited from editing workspace profile/slug, billing, deletion, or promoting users. |
| `workspace_member` | `reseller_staff` | 10 | Team staff (designers, copywriters, sales, support). Can manage client businesses and view workspace directory. Prohibited from administrative actions. |

### Centralized Permission Matrix

| Permission | `workspace_owner` | `workspace_admin` | `workspace_member` |
| :--- | :---: | :---: | :---: |
| `workspace:view` | Allowed | Allowed | Allowed |
| `workspace:manage_businesses` | Allowed | Allowed | Allowed |
| `workspace:invite_member` | Allowed | Allowed (members only) | Denied |
| `workspace:remove_member` | Allowed | Allowed (members only) | Denied |
| `workspace:change_role` | Allowed | Denied | Denied |
| `workspace:update_profile` | Allowed | Denied | Denied |
| `workspace:manage_billing` | Allowed | Denied | Denied |
| `workspace:delete` | Allowed | Denied | Denied |

### Role Hierarchy Rules
1. **Strict Downward Authority:** An actor can only manage or invite members with a strictly lower rank than themselves (`actorRank > targetRank`).
2. **Escalation Prevention:** Administrators cannot assign or invite other administrators or owners. Only a `workspace_owner` can grant administrative privileges.
3. **Last-Owner Protection:** A workspace must retain at least one active `workspace_owner`. Any action that would demote or remove the sole owner is blocked at the service level with a `LAST_OWNER_PROTECTION` error.

---

## 3. Member Invitation Lifecycle

Invitations are implemented with cryptographic security and single-use validation:

```
[Actor: Owner/Admin]
        │
        ▼ (inviteWorkspaceMember)
Generates 32-Byte Hex Token (64 chars)
        │
        ├─► Computes SHA-256 Hash ──► Stores in public.workspace_invitations
        │                               (token_hash, email, role, expires_at: +7d)
        │
        └─► Returns Plaintext Token to Actor (Never Persisted / Redacted from Logs)
                │
                ▼ (Transmitted out-of-band or via email)
        [Invitee User]
                │
                ▼ (acceptWorkspaceInvitation)
Submits Plaintext Token
        │
        ├─► Computes SHA-256 Hash
        ├─► Finds Record matching token_hash & status == 'pending'
        ├─► Verifies expires_at > now()
        ├─► Verifies Authenticated User Email == Invitation Email (Case-Insensitive)
        │
        ├─► Inserts/Upserts public.workspace_members (role, status: 'active')
        ├─► Updates public.workspace_invitations (status: 'accepted')
        └─► Emits Immutable Audit Log
```

---

## 4. Database Schema Hardening & Migrations

### Migration `20261112000003_secure_search_path_and_workspace_roles.sql`
This forward-only migration implements two critical security enhancements:

1. **Search Path Hardening in Trigger Functions:**
   - Redefines `public.handle_new_auth_user()` with `SECURITY DEFINER SET search_path = ''`.
   - Ensures all object references are schema-qualified (`pg_catalog.coalesce`, `pg_catalog.split_part`, `public.users`, `public.user_auth_identities`).
   - Completely eliminates search path hijacking vulnerabilities in PostgreSQL `SECURITY DEFINER` execution contexts.

2. **Expanded Role Constraints:**
   - Drops and recreates `workspace_members_role_check` to accept canonical roles:
     `CHECK (role IN ('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff'))`.

3. **`public.workspace_invitations` Table:**
   - Dedicated table for invitation tracking with `token_hash`, `email`, `role`, `status`, `expires_at`, and Row-Level Security enabled.

---

## 5. Audit Trail & Redaction Guarantees

Every sensitive workspace operation generates an append-only entry in `public.audit_logs`:
- `workspace.created`
- `workspace.profile_updated`
- `workspace.member_invited`
- `workspace.invitation_accepted`
- `workspace.member_role_changed`
- `workspace.member_removed`
- `workspace.member_left`

### Redaction Rules
- Raw invitation tokens, passwords, session secrets, and payment tokens are **strictly excluded** from audit log metadata.
- Audit logs record only actor ID, target user ID, role changes, and non-sensitive identifiers.
