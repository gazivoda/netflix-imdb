import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import JsonLd from '../../components/JsonLd';
import { graph, pageMetadata, softwareApplication } from '../../lib/seo';
import { CHROME_WEB_STORE_URL } from '../../lib/content';
import { PricingLead, ProCard } from './PricingClient';
import s from '../../components/billing/billing.module.css';

export const metadata = pageMetadata('/pricing');

export default function PricingPage() {
  return (
    <div className={s.page}>
      <JsonLd data={graph(softwareApplication())} />
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Pricing</h1>
        <PricingLead />
        <div className={s.tiers}>
          <section className={`ds-card ${s.tier}`}>
            <h2 className={`ds-display ${s.h2}`}>Free</h2>
            <ul className={s.list}>
              <li>Chrome extension badges on Netflix</li>
              <li>IMDb and Rotten Tomatoes scores</li>
              <li>No account needed</li>
            </ul>
            <a className={`ds-btn ${s.cta}`} href={CHROME_WEB_STORE_URL}>Add to Chrome</a>
          </section>
          <ProCard />
        </div>
        <p className={s.fine}>Payments are handled by Paddle, our merchant of record. See the <a href="/terms">terms</a> and <a href="/refund-policy">refund policy</a>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
