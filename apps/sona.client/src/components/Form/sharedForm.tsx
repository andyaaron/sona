import { formOptions } from '@tanstack/react-form';
import { createPatientSchema } from '@sona/shared';
import type { CreatePatientInput } from '@sona/shared';

export const addPatientFormOpts = formOptions({
  defaultValues: {
    mrn: '',
    firstName: '',
    lastName: '',
    dob: '',
    phoneNumber: '',
    smsConsent: false,
    primaryProviderId: null,
  } as CreatePatientInput,
  validators: {
    onChangeAsync: createPatientSchema,
  },
});
