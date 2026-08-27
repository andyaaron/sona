import type {
  CreatePatientInput,
  CreateProviderInput,
  MessageOut,
  NotifyPatientInput,
  Patient,
  Provider,
  UpdatePatientInput,
  UpdateProviderInput,
} from "@sona/shared";
import { apiFetch } from "./client";

export const patientsApi = {
  list: (params?: { providerId?: string }) => {
    const query = params?.providerId
      ? `?providerId=${encodeURIComponent(params.providerId)}`
      : "";
    return apiFetch<Patient[]>(`/api/patients${query}`);
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
