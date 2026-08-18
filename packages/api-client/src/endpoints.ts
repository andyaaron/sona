import type {
  CreatePatientInput,
  MessageOut,
  NotifyPatientInput,
  Patient,
  UpdatePatientInput,
} from "@sona/shared";
import { apiFetch } from "./client";

export const patientsApi = {
  list: () => apiFetch<Patient[]>("/api/patients"),
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
