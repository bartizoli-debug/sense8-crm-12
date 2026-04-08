'use client';

import React from 'react';
import { ui } from './tokens';

type Option = { value: string; label: string };

type Props = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
};

export function Select({ label, value, onChange, options, disabled }: Props) {
  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {label ? (
        <label style={{ fontSize: 12, color: ui.color.text3, marginBottom: 6, display: 'block' }}>
          {label}
        </label>
      ) : null}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: 40,
          padding: '0 12px',
          borderRadius: ui.radius.md,
          border: `1px solid ${ui.color.border}`,
          background: disabled ? ui.color.surface2 : ui.color.surface,
          color: ui.color.text,
          fontSize: 13,
          outline: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Select;
