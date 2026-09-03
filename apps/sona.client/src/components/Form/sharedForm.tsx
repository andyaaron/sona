import { formOptions } from '@tanstack/react-form';
import { createPatientSchema } from '@sona/shared';
import type { CreatePatientInput } from '@sona/shared';
import { validateWithSchema } from '@/lib/schema-validation';

export const addPatientFormOpts = formOptions({
  defaultValues: {
    mrn: '',
    firstName: '',
    lastName: '',
    dob: '',
    phoneNumber: '',
    smsConsent: false,
    // '' keeps the provider <select> controlled; '' → null happens before validation and on submit
    primaryProviderId: '',
  } as CreatePatientInput,
  validators: {
    // The provider select holds '' for "Unassigned"; the contract wants null.
    // Validate what will be submitted, or every unassigned patient fails on
    // "Invalid GUID" and the form silently refuses to save.
    onChangeAsync: ({ value }) =>
      validateWithSchema(createPatientSchema, {
        ...value,
        primaryProviderId: value.primaryProviderId || null,
      }),
  },
});
