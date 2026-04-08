'use client';

import React from 'react';

type Props = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  hint?: string;
};

export function InputDate({
  label,
  value,
  onChange,
  disabled,
  required,
  min,
  max,
  hint,
}: Props) {
  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {label ? (
        <label
          style={{
            display: 'block',
            marginBottom: 6,
            fontSize: 12,
            fontWeight: 500,
            color: '#6b7280',
          }}
        >
          {label} {required ? <span style={{ color: '#9ca3af' }}>*</span> : null}
        </label>
      ) : null}

      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        style={{
          width: '100%',
          height: 40,
          padding: '0 12px',
          borderRadius: 10,
          border: '1px solid #d1d5db',
          background: disabled ? '#f9fafb' : '#ffffff',
          color: '#111827',
          outline: 'none',
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      />

      {hint ? <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>{hint}</div> : null}
    </div>
  );
}

export default InputDate;
