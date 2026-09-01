import type {
  CreatePatientInput,
  CreateProviderInput,
  MessageOut,
  NotifyPatientInput,
  PagedResult,
  Patient,
  PatientSortField,
  Provider,
  SortDirection,
  UpdatePatientInput,
  UpdateProviderInput,
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
