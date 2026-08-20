import { useStore } from '@tanstack/react-store';
import { useFieldContext } from '@/hooks/form-context.tsx';

interface TextAreaProps {
  label: string;
  placeholder?: string;
  name?: string;
  canEdit?: boolean;
}

export default function TextAreaField({
  label,
  placeholder = '',
  name = '',
  canEdit = true,
}: TextAreaProps) {
  const field = useFieldContext<string>();
  const {
    value,
    meta: { isTouched },
  } = field.state;

  const isSubmitted = useStore(field.form.store, (state) => state.isSubmitted);
  const errors = useStore(field.store, (state) => state.meta.errors);
  const hasError = (isSubmitted || isTouched) && errors.length > 0;

  return (
    <div className="w-full mb-4">
      <label>
        <div className="text-gray-500 font-semibold text-sm mb-1">
          {label}
        </div>
        <textarea
          id={field.name}
          placeholder={placeholder}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50 ${hasError ? 'border-red-400' : 'border-gray-300'}`}
          value={value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          disabled={!canEdit}
          name={name}
        />
      </label>
      {(isSubmitted || isTouched) &&
        errors.map((error, i) => (
          <div key={i} className="text-sm text-red-600 mt-1">
            {typeof error === 'object' && error !== null && 'message' in error
              ? (error as any).message
              : String(error)}
          </div>
        ))}
    </div>
  );
}
