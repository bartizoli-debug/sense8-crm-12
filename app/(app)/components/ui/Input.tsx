'use client';

import React, { useState } from 'react';
import { ui } from './tokens';

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  error?: string;
  min?: string;
  max?: string;
};

export function Input({ label, value, onChange, placeholder, disabled, type = 'text', error, min, max }: Props) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {label ? (
        <label
          style={{
            fontSize: ui.font.size.sm,
            color: ui.color.text2,
            marginBottom: 6,
            display: 'block',
            fontWeight: ui.font.weight.medium,
          }}
        >
          {label}
        </label>
      ) : null}

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: 40,
          padding: '0 14px',
          borderRadius: ui.radius.md,
          border: `1px solid ${error ? ui.color.danger : isFocused ? ui.color.primary : ui.color.border}`,
          background: disabled ? ui.color.surface2 : ui.color.surface,
          color: ui.color.text,
          fontSize: ui.font.size.base,
          outline: 'none',
          transition: ui.transition.fast,
          boxShadow: isFocused ? `0 0 0 3px ${ui.color.primaryLight}` : 'none',
        }}
      />

      {error ? (
        <div
          style={{
            marginTop: 4,
            fontSize: ui.font.size.xs,
            color: ui.color.danger,
            fontWeight: ui.font.weight.medium,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default Input;