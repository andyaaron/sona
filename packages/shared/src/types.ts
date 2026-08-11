export type UserRole = "nurse" | "provider" | "admin";

/** Internal staff user of the admin platform (nurse, provider, admin). */
export interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  email: string;
  isActive: boolean;
}

export type PatientImportSource = "flatfile" | "ui" | "cerner";

export interface Patient {
  id: string;
  /** Person-level medical record number — unique business identifier */
  mrn: string;
  firstName: string;
  lastName: string;
  /** ISO date (YYYY-MM-DD) */
  dob: string;
  /** E.164 format, e.g. +15551234567 */
  phoneNumber: string;
  /** TCPA: no SMS may be sent while false */
  smsConsent: boolean;
  /** ISO datetime when consent was captured, null if never */
  smsConsentDate: string | null;
  /** True once the patient has installed and registered the mobile app */
  hasApp: boolean;
  /** Whether the patient exists in Cerner */
  inCerner: boolean;
  /** Which ingest path last wrote this record */
  importSource: PatientImportSource;
  /** Soft delete — inactive patients are hidden, never hard-deleted */
  isActive: boolean;
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
