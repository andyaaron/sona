// createFormHook returns hooks/HOCs and needs the (lazy) field components in scope; this file is
// not a component module, so Fast Refresh boundaries do not apply.
/* oxlint-disable react/only-export-components */
import { lazy } from 'react';
import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from '@/hooks/form-context.tsx';

const TextField = lazy(() => import('@/components/Form/TextField'));
const TextAreaField = lazy(() => import('@/components/Form/TextAreaField'));
const SelectField = lazy(() => import('@/components/Form/SelectField'));
const SubscribeButton = lazy(() => import('@/components/Form/SubscribeButton'));

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    TextField,
    TextAreaField,
    SelectField,
  },
  formComponents: {
    SubscribeButton,
  },
  fieldContext,
  formContext,
});
