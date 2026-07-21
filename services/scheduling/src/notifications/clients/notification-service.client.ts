import type {
  AppointmentSummary,
  NotificationChannel,
} from '@hep/shared-types';

export interface NotificationClientResult {
  outcome: 'succeeded' | 'failed';
  error?: string;
}

/**
 * Port over which `AppointmentsService` sends a booking-confirmation
 * notification (BAC-16's AC: "Booking triggers a confirmation notification")
 * once a slot is successfully booked. A real, synchronous HTTP call to
 * `services/notification`'s `POST /notifications/internal` -- mirrors
 * `services/tenant`'s BAC-12 `NotificationServiceClient`/
 * `HttpNotificationServiceClient` exactly (see that interface's doc comment
 * for why this is a real inter-service HTTP call, not a domain event: this
 * is a single, user-facing booking action that must reliably queue its own
 * confirmation, and no real event-bus publisher exists anywhere in this
 * repo/sandbox to fire one through anyway).
 *
 * `services/scheduling` does not itself store patient contact details (only
 * `patientId` -- `services/patient`'s (BAC-14) data) -- see
 * `CreateAppointmentRequest.notifyChannel`/`.notifyTo`'s doc comment in
 * `@hep/shared-types` for why the caller supplies the delivery destination.
 */
export interface NotificationServiceClient {
  sendAppointmentConfirmation(
    tenantId: string,
    channel: NotificationChannel,
    to: string,
    appointment: Pick<AppointmentSummary, 'id' | 'startTime' | 'endTime'>,
  ): Promise<NotificationClientResult>;
}

export const NOTIFICATION_SERVICE_CLIENT = Symbol(
  'NOTIFICATION_SERVICE_CLIENT',
);
