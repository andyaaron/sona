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
 * An outbound "ready to be seen" message from a staff user to a patient.
 * Delivered via push if the patient has the app, otherwise SMS.
 * This record is the send audit log; content must never contain PHI —
 * see docs/compliance.md. Mirrors the MessagesOut table (docs/data-model.md).
 */
export interface MessageOut {
  id: string;
  patientId: string;
  sentByUserId: string;
  channel: NotificationChannel;
  /** Approved template the body was rendered from; never caller-supplied text */
  messageTemplateId: string | null;
  /** Rendered text as actually sent (audit snapshot) */
  body: string | null;
  /** Number dialed at send time; null for push */
  mobileNumber: string | null;
  status: NotificationStatus;
  /** SMS provider message SID / push ticket id, once dispatched */
  providerMessageSid: string | null;
  failureReason: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
}
