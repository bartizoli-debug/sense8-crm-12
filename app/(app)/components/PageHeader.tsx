'use client';

import React from 'react';
import { ui } from './ui/tokens';

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
};

type Tab = {
  key: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
};

type Props = {
  title: string;
  subtitle?: string;

  // legacy API (kept)
  actions?: Action[];

  // preferred API
  right?: React.ReactNode;

  // optional tabs row
  tabs?: Tab[];
};

const headerWrap: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: ui.color.surface,
  border: `1px solid ${ui.color.border}`,
  borderRadius: ui.radius.lg,
  padding: ui.space.md,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: ui.color.text,
  lineHeight: 1.2,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: ui.color.text3,
  marginTop: 6,
  lineHeight: 1.3,
};

function pill(active: boolean, primary?: boolean): React.CSSProperties {
  if (primary) {
    return {
      height: 34,
      padding: '0 12px',
      borderRadius: 999,
      border: `1px solid ${ui.color.primary}`,
      background: ui.color.primary,
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
      textDecoration: 'none',
    };
  }

  return {
    height: active ? 32 : 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? ui.color.primary : ui.color.border}`,
    background: active ? ui.color.primarySoft : ui.color.surface,
    color: active ? ui.color.primaryHover : ui.color.text,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    textDecoration: 'none',
  };
}

export default function PageHeader({ title, subtitle, actions = [], right, tabs }: Props) {
  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: ui.space.sm }}>
      <div style={headerWrap}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: ui.space.sm,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={titleStyle}>{title}</div>
            {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
          </div>

          <div style={{ display: 'flex', gap: ui.space.xs, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {right
              ? right
              : actions.map((action, idx) => {
                  const style = pill(false, action.primary);

                  if (action.href) {
                    return (
                      <a key={idx} href={action.href} style={style}>
                        {action.label}
                      </a>
                    );
                  }

                  return (
                    <button key={idx} type="button" onClick={action.onClick} style={style}>
                      {action.label}
                    </button>
                  );
                })}
          </div>
        </div>
      </div>

      {tabs && tabs.length > 0 ? (
        <div style={{ display: 'flex', gap: ui.space.xs, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={t.onClick} style={pill(!!t.active, false)} aria-pressed={!!t.active}>
              {t.label}
              {typeof t.count === 'number' ? (
                <span
                  style={{
                    marginLeft: 8,
                    height: 20,
                    padding: '0 8px',
                    borderRadius: 999,
                    border: `1px solid ${ui.color.border}`,
                    background: ui.color.surface,
                    color: ui.color.text2,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
