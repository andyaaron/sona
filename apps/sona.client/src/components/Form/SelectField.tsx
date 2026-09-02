import { useStore } from '@tanstack/react-store';
import { useFieldContext } from '@/hooks/form-context.tsx';
import type { ReactNode } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string | ReactNode;
  placeholder?: string;
  canEdit?: boolean;
  options: SelectOption[];
  emptyOptionLabel?: string;
  emptyOptionValue?: string;
  /** data-testid on the select; errors render as `${testId}-error`. */
  testId?: string;
}

export default function SelectField({
  label,
  placeholder = 'Select...',
  canEdit = true,
  options,
  emptyOptionLabel,
  emptyOptionValue = '',
  testId,
}: SelectFieldProps) {
  const field = useFieldContext<string>();

  const {
    value,
    meta: { isTouched },
  } = field.state;
  const isSubmitted = useStore(field.form.store, (state) => state.isSubmitted);
  const errors = useStore(field.store, (state) => state.meta.errors);

  return (
    <div className={'mb-4'}>
      <label>
        <div className={'text-gray-500 font-semibold text-sm mb-1'}>
          {label}
        </div>
        <select
          data-testid={testId}
          className={
            'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
          }
          value={value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          disabled={!canEdit}
        >
          {emptyOptionLabel ? (
            <option value={emptyOptionValue}>{emptyOptionLabel}</option>
          ) : (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {(isTouched || isSubmitted) &&
        errors.map((error, index) => {
          const message =
            typeof error === 'string'
              ? error
              : error && typeof error === 'object' && 'message' in error
                ? (error as { message: string }).message
                : String(error);
          return (
            <div key={index} data-testid={testId ? `${testId}-error` : undefined} className={'text-sm text-red-600'}>
              {message}
            </div>
          );
        })}
    </div>
  );
}

