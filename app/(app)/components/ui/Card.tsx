'use client';

import React from 'react';
import { ui } from './tokens';

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: keyof typeof ui.space;
  hover?: boolean;
};

export function Card({ children, style, padding = 'md', hover = false }: Props) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        background: ui.color.surface,
        border: `1px solid ${ui.color.border}`,
        borderRadius: ui.radius.lg,
        padding: ui.space[padding],
        boxShadow: isHovered && hover ? ui.shadow.md : ui.shadow.xs,
        transition: ui.transition.base,
        transform: isHovered && hover ? 'translateY(-2px)' : 'translateY(0)',
        ...style,
      }}
      onMouseEnter={hover ? () => setIsHovered(true) : undefined}
      onMouseLeave={hover ? () => setIsHovered(false) : undefined}
    >
      {children}
    </div>
  );
}
