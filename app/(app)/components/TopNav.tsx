'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import QuickCreateModal from './QuickCreateModal';
import GlobalSearch from './GlobalSearch';

const ui = {
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  text2: '#4b5563',
  muted: '#6b7280',
  bg: '#ffffff',
  bgHover: '#f9fafb',
  primary: '#2DA745',
  primaryHover: '#248a37',
  shadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  shadowLg: '0 4px 12px rgba(0, 0, 0, 0.1)',
};

const navWrap: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: ui.bg,
  borderBottom: `1px solid ${ui.border}`,
  boxShadow: ui.shadow,
};

const inner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 20px',
};

const left: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
};

const right: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const pillBase: React.CSSProperties = {
  fontSize: 13,
  padding: '8px 14px',
  borderRadius: 10,
  border: `1px solid ${ui.borderLight}`,
  background: '#fff',
  color: ui.text,
  textDecoration: 'none',
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  transition: 'all 120ms ease',
};

const brandPill: React.CSSProperties = {
  ...pillBase,
  borderColor: ui.border,
  background: ui.primary,
  color: '#ffffff',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  width: 360,
  maxWidth: '56vw',
  padding: '9px 14px',
  borderRadius: 10,
  border: `1px solid ${ui.border}`,
  outline: 'none',
  fontSize: 13,
  fontWeight: 500,
  height: 36,
  transition: 'all 120ms ease',
  background: ui.bg,
};

const btnStyle = (variant: 'primary' | 'ghost'): React.CSSProperties => ({
  ...pillBase,
  cursor: 'pointer',
  justifyContent: 'center',
  border: variant === 'primary' ? 'none' : `1px solid ${ui.borderLight}`,
  background: variant === 'primary' ? ui.primary : '#fff',
  color: variant === 'primary' ? '#fff' : ui.text2,
  fontWeight: variant === 'primary' ? 600 : 500,
});

const menuWrap: React.CSSProperties = {
  position: 'relative',
};

const menu: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 8px)',
  width: 220,
  borderRadius: 12,
  border: `1px solid ${ui.border}`,
  background: '#fff',
  boxShadow: ui.shadowLg,
  overflow: 'hidden',
};

const menuItem: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  border: 'none',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  color: ui.text,
  fontWeight: 600,
  transition: 'background 120ms ease',
};

const menuItemMuted: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  color: ui.muted,
  borderTop: `1px solid ${ui.borderLight}`,
  background: '#f8fafb',
  lineHeight: 1.4,
};

export default function TopNav() {
  const router = useRouter();

  // Global search
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Quick Create
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as any)) {
        setMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as any)) {
        setSearchOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function handleSearchClose() {
    setSearchOpen(false);
    setQ('');
  }

  function handleNewClick(type: 'company' | 'deal' | 'contact' | 'contract') {
    setMenuOpen(false);

    if (type === 'contact') {
      setQuickOpen(true);
      return;
    }

    if (type === 'company') {
      router.push('/companies/new');
      return;
    }

    if (type === 'deal') {
      router.push('/deals/new');
      return;
    }

    // ✅ FIX: contracts are created on /contracts via a toggle section
    if (type === 'contract') {
      router.push('/contracts?new=1');
      return;
    }
  }

  return (
    <div style={navWrap}>
      <div style={inner}>
        <div style={left}>
          <Link href="/" style={brandPill} title="Home">
            <span>Sense8 CRM</span>
          </Link>
        </div>

        <div style={right}>
          <div style={{ position: 'relative' }} ref={searchRef}>
            <input
              style={inputStyle}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies / deals / contracts / contacts..."
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && q.trim() && <GlobalSearch query={q} onResultClick={handleSearchClose} />}
          </div>

          <div style={menuWrap} ref={menuRef}>
            <button type="button" style={btnStyle('primary')} onClick={() => setMenuOpen((v) => !v)}>
              + New
            </button>

            {menuOpen && (
              <div style={menu}>
                <button type="button" style={menuItem} onClick={() => handleNewClick('company')}>
                  New Company
                </button>
                <button type="button" style={menuItem} onClick={() => handleNewClick('contact')}>
                  New Person
                </button>
                <button type="button" style={menuItem} onClick={() => handleNewClick('deal')}>
                  New Deal
                </button>
                <button type="button" style={menuItem} onClick={() => handleNewClick('contract')}>
                  New Contract
                </button>

                <div style={menuItemMuted}>Tip: Use this from any page to quickly create records.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <QuickCreateModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onCreated={(id) => {
          router.push(`/contacts/${id}`);
        }}
      />
    </div>
  );
}