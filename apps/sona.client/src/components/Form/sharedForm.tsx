import { formOptions } from '@tanstack/react-form';
import { createPatientSchema } from '@sona/shared';
import type { CreatePatientFormValues } from '@sona/shared';

export const addPatientFormOpts = formOptions({
  // Typed as the schema's z.input shape so the zod validator below typechecks
  defaultValues: {
    mrn: '',
    firstName: '',
    lastName: '',
    dob: '',
    phoneNumber: '',
    smsConsent: false,
    primaryProviderId: '',
  } as CreatePatientFormValues,
  validators: {
    onChangeAsync: createPatientSchema,
  },
});
