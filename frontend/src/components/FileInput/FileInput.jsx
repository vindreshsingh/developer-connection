import { forwardRef } from 'react';

const FileInput = forwardRef(function FileInput({ label, hint, onSelect, disabled, ...rest }, ref) {
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
  };

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={disabled}
        className="text-sm"
        {...rest}
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
});

export default FileInput;
