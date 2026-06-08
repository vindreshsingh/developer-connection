import { forwardRef } from 'react';
import './FileInput.scss';

const FileInput = forwardRef(function FileInput({ label, hint, onSelect, disabled, ...rest }, ref) {
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div>
      {label && <label className="dc-form-input-label">{label}</label>}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={disabled}
        className="dc-file-input"
        {...rest}
      />
      {hint && <p className="dc-file-input-hint">{hint}</p>}
    </div>
  );
});

export default FileInput;
