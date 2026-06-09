import { classNames } from '@/commonUtils/classNames';
import './FormInput.scss';

export default function FormInput({ label, as = 'input', className = '', wrapperClassName = '', ...rest }) {
  const Field = as;

  return (
    <div className={wrapperClassName}>
      {label && <label className="dc-form-input-label">{label}</label>}
      <Field className={classNames('dc-form-input', className)} {...rest} />
    </div>
  );
}
