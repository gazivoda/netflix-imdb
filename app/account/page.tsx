import type { Metadata } from 'next';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import AccountClient from './AccountClient';
import s from '../../components/billing/billing.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account', robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Account</h1>
        <AccountClient />
      </main>
      <SiteFooter />
    </div>
  );
}
