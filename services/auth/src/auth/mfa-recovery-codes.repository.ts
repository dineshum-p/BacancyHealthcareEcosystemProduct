import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { quoteSchemaIdentifier } from '../tenants/schema-identifier.util';

/**
 * Data access for a tenant's `<schema>.mfa_recovery_codes` table. Only ever
 * receives hashes (see `recovery-code.util.ts#hashRecoveryCode`) -- the raw
 * recovery codes are returned to the caller exactly once, by `AuthService`,
 * and never passed to this repository.
 *
 * No redemption/lookup method exists yet: this ticket's ACs don't specify a
 * recovery-code-login flow, so this repository is currently write-only
 * (a deliberate scope call -- see BAC-6 report, mirroring BAC-5's decision
 * to skip a logout endpoint).
 */
@Injectable()
export class MfaRecoveryCodesRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Replaces every recovery-code hash stored for `userId` with `codeHashes`.
   * Used by `AuthService.verifyMfaEnrollment` immediately after activation,
   * where "replace" is equivalent to "insert" (a newly-activated user has no
   * prior codes) but also correctly handles a hypothetical future
   * re-issuance flow without leaving stale hashes behind.
   */
  async replaceAll(userId: string, codeHashes: string[]): Promise<void> {
    const client = await this.tenantContext.getSchemaBoundClient();
    const schema = quoteSchemaIdentifier(
      this.tenantContext.getTenant().schemaName,
    );

    await client.query(
      `DELETE FROM ${schema}.mfa_recovery_codes WHERE user_id = $1`,
      [userId],
    );
    for (const codeHash of codeHashes) {
      await client.query(
        `INSERT INTO ${schema}.mfa_recovery_codes (id, user_id, code_hash) VALUES ($1, $2, $3)`,
        [randomUUID(), userId, codeHash],
      );
    }
  }
}
