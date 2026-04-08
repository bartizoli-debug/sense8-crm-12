'use client';

import React from 'react';

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="scroll-x"
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        WebkitOverflowScrolling: 'touch',
        // Sticky scrollbar: make scrollbar always accessible without scrolling to bottom
        position: 'sticky',
        bottom: 0,
      }}
    >
      <div style={{ overflowX: 'auto', width: '100%' }}>
        {children}
      </div>
    </div>
  );
}