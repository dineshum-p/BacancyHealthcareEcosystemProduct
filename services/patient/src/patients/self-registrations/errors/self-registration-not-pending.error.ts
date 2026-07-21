/**
 * Thrown when staff try to approve/reject/merge a self-registration that has
 * already been reviewed (BAC-36) -- a review decision may only be applied
 * once, from `'pending'`. The controller maps this to a 409 Conflict.
 */
export class SelfRegistrationNotPendingError extends Error {
  constructor(id: string, currentStatus: string) {
    super(
      `Self-registration "${id}" is not pending review (current status: "${currentStatus}").`,
    );
    this.name = 'SelfRegistrationNotPendingError';
  }
}
