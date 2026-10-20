import { pageMetadata } from '../../lib/seo';
import { SUPPORT_EMAIL } from '../../lib/content';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import s from '../privacy/privacy.module.css';

export const metadata = pageMetadata('/refund-policy');

export default function RefundPolicyPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Refund Policy</h1>
        <p className={`ds-label ${s.updated}`}>
          Last updated: October 20, 2026
        </p>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Full refund within 14 days</h2>
          <p>
            If you ask within 14 days of your first Rating Watch Pro payment, we refund that payment
            in full.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>How to ask</h2>
          <p>
            Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
            from the address on your account and say that you want a refund.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>How long it takes</h2>
          <p>
            Paddle issues the refund to the original payment method. It usually appears within 5 to
            10 business days.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>After a refund</h2>
          <p>
            Pro access ends when a refund is issued. Renewals after the first payment are not
            refundable, except where the law requires it.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Your legal rights</h2>
          <p>
            Consumers in the EU and the UK keep their statutory rights. Nothing in this policy
            limits them.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
