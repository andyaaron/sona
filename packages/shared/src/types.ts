export type UserRole = "nurse" | "provider" | "admin";

export interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  email: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  /** E.164 format, e.g. +15551234567 */
  phoneNumber: string;
  /** True once the patient has installed and registered the mobile app */
  hasApp: boolean;
}

export type NotificationChannel = "push" | "sms";

export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed";

/**
 * A "ready to be seen" ping from a provider to a patient.
 * Delivered via push if the patient has the app, otherwise SMS.
 * Message content must never contain PHI — see docs/compliance.md.
 */
export interface ReadyNotification {
  id: string;
  patientId: string;
  sentByProviderId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  createdAt: string;
  deliveredAt: string | null;
}
