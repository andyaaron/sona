import type {
  CreatePatientInput,
  MessageOut,
  NotifyPatientInput,
  Patient,
} from "@sona/shared";
import { apiFetch } from "./client";

export const patientsApi = {
  list: () => apiFetch<Patient[]>("/api/patients"),
  get: (id: string) => apiFetch<Patient>(`/api/patients/${id}`),
  create: (input: CreatePatientInput) =>
    apiFetch<Patient>("/api/patients", { method: "POST", body: input }),
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
