import { classNames } from '@/commonUtils/classNames';

export default function FormInput({ label, as = 'input', className = '', wrapperClassName = '', ...rest }) {
  const Field = as;

  return (
    <div className={wrapperClassName}>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <Field
        className={classNames(
          'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:shadow-[0_0_0_2px_rgba(192,132,252,0.6)]',
          className,
        )}
        {...rest}
      />
    </div>
  );
}
