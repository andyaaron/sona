import type {
  AppUserSummary,
  CreateDepartmentInput,
  CreateOrganizationInput,
  CreatePatientInput,
  CreateProviderInput,
  CreateSiteInput,
  Department,
  DirectoryUser,
  InviteUserInput,
  MessageOut,
  NotifyPatientInput,
  OpieScheduleQuery,
  OpieScheduledPatient,
  Organization,
  PagedResult,
  Patient,
  PatientSortField,
  Provider,
  Site,
  SortDirection,
  UpdateDepartmentInput,
  UpdatePatientInput,
  UpdateProviderInput,
  UpdateSiteInput,
  UpdateUserInput,
  UserRole,
} from "@sona/shared";
import { apiFetch } from "./client";

export interface PatientListParams {
  page?: number;
  pageSize?: number;
  sortBy?: PatientSortField;
  sortDir?: SortDirection;
  search?: string;
  providerId?: string;
}

export const patientsApi = {
  list: (params?: PatientListParams) => {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
    if (params?.sortBy !== undefined) query.set("sortBy", params.sortBy);
    if (params?.sortDir !== undefined) query.set("sortDir", params.sortDir);
    if (params?.search) query.set("search", params.search);
    if (params?.providerId) query.set("providerId", params.providerId);
    const qs = query.toString();
    return apiFetch<PagedResult<Patient>>(`/api/patients${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiFetch<Patient>(`/api/patients/${id}`),
  create: (input: CreatePatientInput) =>
    apiFetch<Patient>("/api/patients", { method: "POST", body: input }),
  update: (input: UpdatePatientInput) =>
    apiFetch<Patient>(`/api/patients/${input.id}`, {
      method: "PUT",
      body: input,
    }),
  delete: (id: string) =>
    apiFetch<void>(`/api/patients/${id}`, { method: "DELETE" }),
};

export const providersApi = {
  list: (params?: { isActive?: boolean }) => {
    const query =
      params?.isActive !== undefined
        ? `?isActive=${params.isActive}`
        : "";
    return apiFetch<Provider[]>(`/api/providers${query}`);
  },
  create: (input: CreateProviderInput) =>
    apiFetch<Provider>("/api/providers", { method: "POST", body: input }),
  update: (input: UpdateProviderInput) =>
    apiFetch<Provider>(`/api/providers/${input.id}`, {
      method: "PUT",
      body: input,
    }),
};

export const organizationsApi = {
  /** system_admin: all orgs; org_admin: own org only. */
  list: () => apiFetch<Organization[]>("/api/organizations"),
  create: (input: CreateOrganizationInput) =>
    apiFetch<Organization>("/api/organizations", { method: "POST", body: input }),
  listSites: (organizationId: string) =>
    apiFetch<Site[]>(`/api/organizations/${organizationId}/sites`),
  createSite: (organizationId: string, input: CreateSiteInput) =>
    apiFetch<Site>(`/api/organizations/${organizationId}/sites`, {
      method: "POST",
      body: input,
    }),
  updateSite: (input: UpdateSiteInput) =>
    apiFetch<Site>(`/api/sites/${input.id}`, { method: "PUT", body: input }),
  listDepartments: (siteId: string) =>
    apiFetch<Department[]>(`/api/sites/${siteId}/departments`),
  createDepartment: (siteId: string, input: CreateDepartmentInput) =>
    apiFetch<Department>(`/api/sites/${siteId}/departments`, {
      method: "POST",
      body: input,
    }),
  updateDepartment: (input: UpdateDepartmentInput) =>
    apiFetch<Department>(`/api/departments/${input.id}`, {
      method: "PUT",
      body: input,
    }),
};

export const usersApi = {
  /** org_admin: own org + the unassigned pending queue; system_admin: all. */
  list: (params?: { role?: UserRole }) => {
    const query = params?.role ? `?role=${params.role}` : "";
    return apiFetch<AppUserSummary[]>(`/api/users${query}`);
  },
  update: (id: number, input: UpdateUserInput) =>
    apiFetch<AppUserSummary>(`/api/users/${id}`, { method: "PUT", body: input }),
  directorySearch: (q: string) =>
    apiFetch<DirectoryUser[]>(`/api/users/directory-search?q=${encodeURIComponent(q)}`),
  invite: (input: InviteUserInput) =>
    apiFetch<AppUserSummary>("/api/users/invite", { method: "POST", body: input }),
};

export const notificationsApi = {
  /** Ping a patient that they're ready to be seen (push if hasApp, else SMS). */
  notifyReady: (input: NotifyPatientInput) =>
    apiFetch<MessageOut>("/api/notifications/ready", {
      method: "POST",
      body: input,
    }),
  listForPatient: (patientId: string) =>
    apiFetch<MessageOut[]>(`/api/patients/${patientId}/notifications`),
};

export const opieApi = {
  /**
   * Patients on the external Opie schedule for one day (server defaults to today).
   * 503 `{ error: "opie-not-configured" }` when no OpieConnection is set;
   * 502 `{ error: "opie-unavailable" }` when the Opie server cannot be reached.
   */
  schedule: (params?: OpieScheduleQuery) => {
    const query = params?.date ? `?date=${params.date}` : "";
    return apiFetch<OpieScheduledPatient[]>(`/api/opie/schedule${query}`);
  },
};
