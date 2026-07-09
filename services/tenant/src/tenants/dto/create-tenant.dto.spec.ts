import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTenantDto } from './create-tenant.dto';

/**
 * BAC-7: `ownerEmail` is required at tenant-creation time (the single email
 * address permitted to bootstrap this tenant's `super_admin` in
 * `services/auth`). These prove the DTO itself rejects a missing/invalid
 * value with a validation error -- `ValidationPipe` in `main.ts` turns that
 * into a `400` at the HTTP boundary (see `tenant-provisioning.e2e-spec.ts`
 * for the end-to-end 400 assertions).
 */
describe('CreateTenantDto', () => {
  const validPayload = {
    name: 'Acme Inc',
    slug: 'acme',
    plan: 'starter',
    ownerEmail: 'owner@acme.example.com',
  };

  it('passes validation with a valid ownerEmail', async () => {
    const dto = plainToInstance(CreateTenantDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing ownerEmail', async () => {
    const { ownerEmail, ...withoutOwnerEmail } = validPayload;
    void ownerEmail;
    const dto = plainToInstance(CreateTenantDto, withoutOwnerEmail);

    const errors = await validate(dto);

    const ownerEmailError = errors.find((e) => e.property === 'ownerEmail');
    expect(ownerEmailError).toBeDefined();
    expect(ownerEmailError?.constraints).toHaveProperty('isEmail');
  });

  it('rejects an invalid (non-email) ownerEmail', async () => {
    const dto = plainToInstance(CreateTenantDto, {
      ...validPayload,
      ownerEmail: 'not-an-email',
    });

    const errors = await validate(dto);

    const ownerEmailError = errors.find((e) => e.property === 'ownerEmail');
    expect(ownerEmailError).toBeDefined();
    expect(ownerEmailError?.constraints).toHaveProperty('isEmail');
  });

  it('rejects an empty-string ownerEmail', async () => {
    const dto = plainToInstance(CreateTenantDto, {
      ...validPayload,
      ownerEmail: '',
    });

    const errors = await validate(dto);

    const ownerEmailError = errors.find((e) => e.property === 'ownerEmail');
    expect(ownerEmailError).toBeDefined();
  });
});
