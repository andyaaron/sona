import { useStore } from '@tanstack/react-store';
import { useFieldContext } from '@/hooks/form-context.tsx';

interface TextAreaProps {
  label: string;
  placeholder?: string;
  name?: string;
  canEdit: boolean;
}

export default function TextAreaField({
  label,
  placeholder = '',
  name = '',
  canEdit,
}: TextAreaProps) {
  const field = useFieldContext<string>();
  const { value } = field.state;

  const isSubmitted = useStore(field.form.store, (state) => state.isSubmitted);
  const errors = useStore(field.store, (state) => state.meta.errors);

  return (
    <div className={'w-full mb-4'}>
      <label
        className="text-gray-500 font-semibold text-sm mb-1"
        htmlFor={field.name}
      >
        {label}
      </label>

      <textarea
        id={field.name}
        placeholder={placeholder}
        className={canEdit ? '' : 'bg-gray-100'}
        value={value}
        onChange={(e) => field.handleChange(e.target.value)}
        disabled={!canEdit}
        name={name}
      />
      {isSubmitted &&
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
