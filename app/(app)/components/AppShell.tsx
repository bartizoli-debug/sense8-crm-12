'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import QuickCreateModal from './QuickCreateModal';
import { supabase } from '@/lib/supabase/client';


type NavItem = {
  href: string;
  label: string;
  emoji?: string;
};

const NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/companies', label: 'Companies' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/deals', label: 'Deals' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/contracts', label: 'Contracts' },
  { href: '/renewals', label: 'Renewals' },
  { href: '/owner-dashboard', label: 'Owner Dashboard' },
  { href: '/expiring-contracts', label: 'Expiring Contracts' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function pageTitleFromPath(pathname: string) {
  const exact = NAV.find((n) => isActive(pathname, n.href));
  if (exact) return exact.label;

  if (pathname.startsWith('/companies/')) return 'Company';
  if (pathname.startsWith('/contacts/')) return 'Contact';
  if (pathname.startsWith('/deals/')) return 'Deal';
  if (pathname.startsWith('/contracts/')) return 'Contract';

  return 'Sense8 CRM';
}

const ui = {
  appBg: '#f9fafb',
  card: '#ffffff',
  border: '#e5e7eb',
  borderSoft: '#f3f4f6',
  text: '#111827',
  text2: '#4b5563',
  muted: '#6b7280',
  primary: '#2DA745',
  primaryHover: '#248a37',
  primaryText: '#ffffff',
  hover: '#f9fafb',
  shadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.03)',
  radius: 6,
};

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [qcOpen, setQcOpen] = useState(false);
  const [qcDefaultType, setQcDefaultType] = useState<'company' | 'deal' | 'contract' | 'contact'>('company');

  const [q, setQ] = useState('');

  const [isNarrow, setIsNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const title = useMemo(() => pageTitleFromPath(pathname), [pathname]);

  useEffect(() => {
    setQcOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onResize() {
      const narrow = window.innerWidth < 1024;
      setIsNarrow(narrow);
      setSidebarOpen(!narrow);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  function openQuickCreate(type: 'company' | 'deal' | 'contract' | 'contact') {
    setQcDefaultType(type);
    setQcOpen(true);
  }

  function onQuickCreated(payload: { type: 'company' | 'deal' | 'contract' | 'contact'; id: any }) {
    const id = String(payload.id);
    if (payload.type === 'company') router.push(`/companies/${id}`);
    if (payload.type === 'deal') router.push(`/deals/${id}`);
    if (payload.type === 'contract') router.push(`/contracts/${id}`);
    if (payload.type === 'contact') router.push(`/contacts/${id}`);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/companies?search=${encodeURIComponent(query)}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const gridCols = sidebarOpen ? '280px 1fr' : '1fr';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: ui.appBg,
        color: ui.text,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridCols,
          minHeight: '100vh',
        }}
      >
        {sidebarOpen && (
          <aside
            style={{
              position: 'sticky',
              top: 0,
              height: '100vh',
              overflowY: 'auto',
              background: 'linear-gradient(to bottom, #fafbfc 0%, #ffffff 100%)',
              borderRight: '1px solid #e1e4e8',
              padding: 0,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '24px 20px',
                borderBottom: '1px solid #e1e4e8',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: 17,
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  lineHeight: 1.2,
                }}>
                  Sense8 CRM
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#64748b',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}>
                  Sales Management
                </div>
              </div>

              {isNarrow && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #e1e4e8',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: 16,
                    cursor: 'pointer',
                    fontWeight: 400,
                    lineHeight: 1,
                  }}
                  title="Close sidebar"
                >
                  ✕
                </button>
              )}
            </div>

            <nav style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '16px 12px',
              flex: 1,
            }}>
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                const hovered = hoveredNav === item.href;

                const linkStyle: React.CSSProperties = {
                  padding: '11px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: active
                    ? 'linear-gradient(to right, #2DA745 0%, #27923d 100%)'
                    : hovered
                    ? '#f8f9fa'
                    : 'transparent',
                  color: active ? '#ffffff' : '#334155',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textDecoration: 'none',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: active ? '0 2px 4px rgba(45, 167, 69, 0.2)' : 'none',
                  letterSpacing: active ? '0.01em' : '0',
                };

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={linkStyle}
                    onMouseEnter={() => setHoveredNav(item.href)}
                    onMouseLeave={() => setHoveredNav(null)}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div
              style={{
                padding: '16px 12px',
                borderTop: '1px solid #e1e4e8',
                background: '#f8f9fa',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: '#64748b',
                  fontWeight: 700,
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  paddingLeft: 4,
                }}
              >
                Quick Create
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { href: '/companies/new', label: 'New Company', type: 'company' as const },
                  { href: '/deals/new', label: 'New Deal', type: 'deal' as const },
                  { href: null, label: 'New Contact', type: 'contact' as const },
                  { href: null, label: 'New Contract', type: 'contract' as const },
                ].map((item) => {
                  if (item.href) {
                    return (
                      <Link
                        key={item.type}
                        href={item.href}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 7,
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          color: '#1e293b',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 8,
                          textDecoration: 'none',
                          userSelect: 'none',
                          boxSizing: 'border-box',
                          transition: 'all 180ms ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#2DA745';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{
                          fontSize: 16,
                          color: '#2DA745',
                          fontWeight: 600,
                          lineHeight: 1,
                        }}>
                          +
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => openQuickCreate(item.type)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 7,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        color: '#1e293b',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 8,
                        textDecoration: 'none',
                        userSelect: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 180ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#2DA745';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <span style={{
                        fontSize: 16,
                        color: '#2DA745',
                        fontWeight: 600,
                        lineHeight: 1,
                      }}>
                        +
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {userEmail && (
              <div
                style={{
                  padding: '16px 12px',
                  borderTop: '1px solid #e1e4e8',
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #f8f9fa 0%, #f1f3f5 100%)',
                      border: '1px solid #e9ecef',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2DA745 0%, #248a37 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 700,
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(45, 167, 69, 0.25)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {userEmail.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 2,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {userEmail.split('@')[0]}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: 500,
                        }}
                      >
                        {userEmail}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 7,
                      border: '1px solid #e5e7eb',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 180ms ease',
                      letterSpacing: '0.01em',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fee';
                      e.currentTarget.style.borderColor = '#fca5a5';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.color = '#475569';
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              background: '#ffffff',
              borderBottom: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      background: '#ffffff',
                      color: '#374151',
                      fontSize: 14,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                    title="Open sidebar"
                  >
                    ☰
                  </button>
                )}

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      letterSpacing: '-0.01em',
                      color: '#111827',
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 400,
                    }}
                  >
                    {pathname}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <form onSubmit={onSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search companies, deals, contracts..."
                    style={{
                      width: 320,
                      maxWidth: '48vw',
                      minWidth: 200,
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      outline: 'none',
                      fontSize: 14,
                      boxSizing: 'border-box',
                      fontWeight: 400,
                      transition: 'all 150ms ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#2DA745';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45, 167, 69, 0.08)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      background: '#ffffff',
                      color: '#374151',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    Search
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => openQuickCreate('company')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2DA745',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#248a37';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#2DA745';
                  }}
                >
                  + New
                </button>
              </div>
            </div>
          </header>

          <main style={{ padding: 20 }}>
            <div style={{ maxWidth: 1400, margin: '0 auto', minWidth: 0 }}>{children}</div>
          </main>
        </div>
      </div>

      <QuickCreateModal open={qcOpen} onClose={() => setQcOpen(false)} onCreated={onQuickCreated as any} />
    </div>
  );
}
