/** Mirrors the server's UserRoles string constants (docs/tasks/08 design decision 3). */
export type UserRole = "system_admin" | "org_admin" | "staff" | "unassigned";

/** The authenticated user — shape of GET /api/user (CurrentUserDto server-side). */
export type User = {
  hca34Id: string | null;
  displayName: string | null;
  email: string | null;
  role: UserRole;
  /** Tenant — null for system_admin/unassigned */
  organizationId: string | null;
  /** UserDepartmentAccess scoping; only populated for staff */
  departmentIds: string[];
  /** Informational MSGraph department string — not authorization data */
  department: string | null;
};

export type PatientImportSource = "flatfile" | "ui" | "cerner";

/** A provider who sees patients. Separate from AppUser. */
export interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  npi: string | null;
  specialty: string | null;
  appUserId: number | null;
  isActive: boolean;
  createDate: string;
  modDate: string;
}

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
  /** Assigned primary provider (nullable) */
  primaryProviderId: string | null;
  /** Display name of assigned provider, resolved server-side */
  primaryProviderName: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;        // 1-based
  pageSize: number;
  totalCount: number;
}
export type PatientSortField = "lastName" | "firstName" | "mrn" | "dob";
export type SortDirection = "asc" | "desc";

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
  /** AppUser ids are numeric (int PK), unlike the uuid-string ids elsewhere */
  sentByUserId: number;
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
