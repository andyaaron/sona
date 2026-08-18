import { useStore } from '@tanstack/react-store';
import { useFieldContext } from '@/hooks/form-context.tsx';

interface TextFieldProps {
  label: string;
  placeholder?: string;
  canEdit?: boolean;
}
export default function TextField({ label, placeholder = "", canEdit = true }: TextFieldProps) {
  const field = useFieldContext<string>();
  const {
    value,
    meta: { isTouched },
  } = field.state;

  // is form submitted?
  const isSubmitted = useStore(field.form.store, (state) => state.isSubmitted);
  const errors = useStore(field.store, (state) => state.meta.errors);

  return (
    <div className={'w-full mb-4'}>
      <label>
        <div className={'text-gray-500 text-xs mb-1'}>
          {label}
        </div>
        <input
          value={value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          disabled={!canEdit}
          placeholder={placeholder}
        />
      </label>
      {(isSubmitted || isTouched) &&
        errors.map((error, i) => (
          <div key={i} className={'text-sm text-red-600'}>
            {typeof error === 'object' && error !== null && 'message' in error
              ? (error as any).message
              : String(error)}
          </div>
        ))}
    </div>
  );
}
