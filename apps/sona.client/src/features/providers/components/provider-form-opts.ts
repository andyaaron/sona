import { formOptions } from '@tanstack/react-form'
import { createProviderSchema } from '@sona/shared'

export const addProviderFormOpts = formOptions({
  defaultValues: {
    firstName: '',
    lastName: '',
    credentials: '' as string | null | undefined,
    npi: '' as string | null | undefined,
    specialty: '' as string | null | undefined,
    appUserId: null as number | null | undefined,
  },
  validators: {
    onChangeAsync: createProviderSchema,
  },
})
