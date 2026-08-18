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
    smsConsent: false as boolean,
  } satisfies CreatePatientInput,
  validators: {
    onChangeAsync: createPatientSchema,
  },
});
