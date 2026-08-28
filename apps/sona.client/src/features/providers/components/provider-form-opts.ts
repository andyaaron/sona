import { formOptions } from '@tanstack/react-form'
import { createProviderSchema } from '@sona/shared'
import type { CreateProviderInput } from '@sona/shared'

export const addProviderFormOpts = formOptions({
  defaultValues: {
    firstName: '',
    lastName: '',
    credentials: null,
    npi: null,
    specialty: null,
    appUserId: null,
  } as CreateProviderInput,
  validators: {
    onChangeAsync: createProviderSchema,
  },
})
