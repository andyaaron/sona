import { Send } from 'lucide-react';
import { useFormContext } from '../../hooks/form-context.tsx';
import Button from '@/components/button';

interface SubscribeButtonProps {
  label: string;
  name?: string;
  showReset?: boolean;
  showCancel?: boolean;
  onCancel?: () => void;
}

export default function SubscribeButton({
  label,
  name = 'submit',
  showReset = false,
  showCancel = false,
  onCancel,
}: SubscribeButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => {
        return (
          <div className={'flex flex-row gap-2'}>
            {showCancel && onCancel && (
              <button
                className={
                  'bg-gray-500 rounded p-1 w-1/4 text-white cursor-pointer'
                }
                type={'button'}
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <Button
              className={'disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed rounded p-1 w-1/4 cursor-pointer'}
              size={'sm'}
              type="submit"
              disabled={!canSubmit}
              role={'button'}
              name={name}
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Submitting...' : `${label}`}
            </Button>
            {showReset && (
              <button
                className={'bg-gray-500 rounded p-2 text-white cursor-pointer'}
                type={'reset'}
                onClick={(e) => {
                  e.preventDefault();
                  form.reset();
                }}
              >
                Reset
              </button>
            )}
          </div>
        );
      }}
    </form.Subscribe>
  );
}
