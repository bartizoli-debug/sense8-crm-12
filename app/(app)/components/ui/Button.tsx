'use client';

import React, { useState } from 'react';
import { ui } from './tokens';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: Variant;
  size?: Size;
  title?: string;
  style?: React.CSSProperties;
};

export function Button({
  children,
  onClick,
  disabled,
  type = 'button',
  variant = 'secondary',
  size = 'md',
  title,
  style,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);

  const h = size === 'sm' ? 32 : size === 'lg' ? 40 : 36;
  const pad = size === 'sm' ? '0 12px' : size === 'lg' ? '0 16px' : '0 14px';
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;

  const base: React.CSSProperties = {
    height: h,
    padding: pad,
    borderRadius: 6,
    fontSize,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    boxSizing: 'border-box',
    textDecoration: 'none',
    outline: 'none',
    transition: 'all 150ms ease',
  };

  const variants: Record<Variant, React.CSSProperties> = {
    primary: {
      border: 'none',
      background: isHovered && !disabled ? ui.color.primaryHover : ui.color.primary,
      color: '#ffffff',
    },
    secondary: {
      border: `1px solid ${ui.color.border}`,
      background: isHovered && !disabled ? ui.color.surfaceHover : ui.color.surface,
      color: ui.color.text,
    },
    success: {
      border: 'none',
      background: isHovered && !disabled ? ui.color.primaryHover : ui.color.primary,
      color: '#ffffff',
    },
    danger: {
      border: `1px solid ${ui.color.danger}`,
      background: isHovered && !disabled ? ui.color.dangerHover : ui.color.danger,
      color: '#ffffff',
    },
    ghost: {
      border: '1px solid transparent',
      background: isHovered && !disabled ? '#f3f4f6' : 'transparent',
      color: ui.color.text2,
    },
  };

  const finalStyle: React.CSSProperties = {
    ...base,
    ...variants[variant],
    ...style,
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={finalStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  );
}
