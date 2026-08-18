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
