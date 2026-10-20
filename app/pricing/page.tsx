import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { pageMetadata } from '../../lib/seo';
import { PRICES } from '../../lib/billing/client';
import PricingClient from './PricingClient';
import s from '../../components/billing/billing.module.css';

export const metadata = pageMetadata('/pricing');

export default function PricingPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Pricing</h1>
        <p className={s.lead}>The extension is free. AR mode, which draws ratings over your TV through your phone camera, is the paid feature.</p>
        <div className={s.tiers}>
          <section className={`ds-card ${s.tier}`}>
            <h2 className={`ds-display ${s.h2}`}>Free</h2>
            <ul className={s.list}>
              <li>Chrome extension badges on Netflix</li>
              <li>IMDb and Rotten Tomatoes scores</li>
              <li>No account needed</li>
            </ul>
            <a className={`ds-btn ${s.cta}`} href="/install">Install the extension</a>
          </section>
          <section className={`ds-card ${s.tier}`}>
            <h2 className={`ds-display ${s.h2}`}>Pro</h2>
            <p className={s.priceLine}>{PRICES.monthly.label} or {PRICES.yearly.label}</p>
            <ul className={s.list}>
              <li>AR mode: point your phone at the TV</li>
              <li>3-day free trial, no card</li>
              <li>Cancel any time, refund within 14 days of the first payment</li>
            </ul>
            <PricingClient />
          </section>
        </div>
        <p className={s.fine}>Payments are handled by Paddle, our merchant of record. See the <a href="/terms">terms</a> and <a href="/refund-policy">refund policy</a>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
