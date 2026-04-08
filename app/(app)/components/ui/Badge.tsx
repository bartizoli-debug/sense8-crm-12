'use client';

import React from 'react';
import { ui } from './tokens';

type Props = {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'teal' | 'blue' | 'amber' | 'red' | 'gray';
};

const tones: Record<NonNullable<Props['tone']>, { bg: string; border: string; text: string }> = {
  neutral: { bg: ui.color.surface2, border: ui.color.border, text: ui.color.text2 },
  green: { bg: ui.color.successSoft, border: '#86efac', text: '#15803d' },
  teal: { bg: ui.color.primaryLight, border: '#5eead4', text: '#0e7490' },
  blue: { bg: ui.color.infoSoft, border: '#93c5fd', text: '#1e40af' },
  amber: { bg: ui.color.warningSoft, border: '#fcd34d', text: '#b45309' },
  red: { bg: ui.color.dangerSoft, border: '#fca5a5', text: '#b91c1c' },
  gray: { bg: ui.color.surface2, border: ui.color.border, text: ui.color.text3 },
};

export function Badge({ children, tone = 'neutral' }: Props) {
  const t = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        padding: '0 12px',
        borderRadius: ui.radius.full,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.text,
        fontSize: ui.font.size.sm,
        fontWeight: ui.font.weight.semibold,
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
