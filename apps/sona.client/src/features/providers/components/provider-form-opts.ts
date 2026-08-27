import { formOptions } from '@tanstack/react-form'
import { createProviderSchema } from '@sona/shared'
import type { CreateProviderFormValues } from '@sona/shared'

export const addProviderFormOpts = formOptions({
  // Typed as the schema's z.input shape so the zod validator below typechecks
  defaultValues: {
    firstName: '',
    lastName: '',
    credentials: '',
    npi: '',
    specialty: '',
    appUserId: null,
  } as CreateProviderFormValues,
  validators: {
    onChangeAsync: createProviderSchema,
  },
})
