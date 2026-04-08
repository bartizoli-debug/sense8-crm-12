'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TopNav from './components/TopNav';
import AuthButton from './components/AuthButton';

const NAV_GROUPS = [
  {
    label: 'MAIN',
    items: [
      { href: '/',          label: 'Dashboard',  icon: <DashboardIcon /> },
      { href: '/companies', label: 'Companies',  icon: <CompaniesIcon /> },
      { href: '/contacts',  label: 'People',     icon: <PeopleIcon /> },
    ],
  },
  {
    label: 'SALES',
    items: [
      { href: '/deals',     label: 'Deals',      icon: <DealsIcon /> },
      { href: '/pipeline',  label: 'Pipeline',   icon: <PipelineIcon /> },
      { href: '/contracts', label: 'Contracts',  icon: <ContractsIcon /> },
    ],
  },
  {
    label: 'RENEWALS',
    items: [
      { href: '/renewal-center', label: 'Renewal Center', icon: <RenewalIcon /> },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { href: '/profile', label: 'My Profile', icon: <ProfileIcon /> },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f7f7f8' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: '#2DA745',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h5v5H2V4zM9 4h5v5H9V4zM2 11h5v3H2v-3zM9 11h5v3H9v-3z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>Sense8 CRM</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Sales Platform</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ padding: '8px 8px', flex: 1 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: '#9ca3af',
                letterSpacing: '0.08em', padding: '8px 8px 4px',
              }}>
                {group.label}
              </div>
              {group.items.map(({ href, label, icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 8px',
                      borderRadius: 7,
                      marginBottom: 1,
                      color: isActive ? '#166534' : '#374151',
                      background: isActive ? '#f0fdf4' : 'transparent',
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      transition: 'all 100ms ease',
                    }}
                  >
                    <span style={{ color: isActive ? '#2DA745' : '#9ca3af', flexShrink: 0, display: 'flex' }}>
                      {icon}
                    </span>
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #f3f4f6' }}>
          <AuthButton />
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopNav />
        <main style={{ flex: 1, padding: 24, boxSizing: 'border-box', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// SVG Icons
function DashboardIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="8" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="1" y="8" width="6" height="6" rx="1" fill="currentColor"/><rect x="8" y="8" width="6" height="6" rx="1" fill="currentColor"/></svg>;
}
function CompaniesIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 13V5l5-3 5 3v8H9V9H6v4H2z" fill="currentColor"/></svg>;
}
function PeopleIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="4.5" r="2.5" fill="currentColor"/><path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function DealsIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 8l6-6 6 6v6H9v-4H6v4H1V8z" fill="currentColor"/></svg>;
}
function PipelineIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="11" y="1" width="3" height="11" rx="1" fill="currentColor"/></svg>;
}
function ContractsIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 1h9a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/><path d="M5 5h5M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
}
function RenewalIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M12.5 7.5A5 5 0 112.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M12.5 3.5v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function ProfileIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 13c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
}