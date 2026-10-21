import { pageMetadata } from '../../lib/seo';
import { SUPPORT_EMAIL, LEGAL_ENTITY, LEGAL_ADDRESS, GOVERNING_LAW, PRO_PRICING } from '../../lib/content';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import s from '../privacy/privacy.module.css';

export const metadata = pageMetadata('/terms');

export default function TermsPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Terms of Service</h1>
        <p className={`ds-label ${s.updated}`}>
          Last updated: October 21, 2026
        </p>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Who we are</h2>
          <p>
            Rating Watch (rating.watch) provides the service described here. Contact:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            {LEGAL_ENTITY ? ` Operated by ${LEGAL_ENTITY}.` : ''}
            {LEGAL_ADDRESS ? ` Address: ${LEGAL_ADDRESS}.` : ''} For Pro subscriptions the seller of
            record is Paddle, as explained under Subscriptions and billing.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Service</h2>
          <p>
            Rating Watch provides a free Chrome extension and a paid AR mode. Ratings come from the
            OMDb API and are provided as is, without any promise that every title has a score or
            that a score is free of errors. Rating Watch is not affiliated with Netflix, IMDb or
            Rotten Tomatoes.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Accounts</h2>
          <p>
            AR mode requires you to sign in with Google. You are responsible for your Google account
            and for everything done while you are signed in.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Subscriptions and billing</h2>
          <p>
            Pro costs ${PRO_PRICING.monthly} per month or ${PRO_PRICING.yearly} per year, plus any taxes shown at checkout.
            Paddle is the merchant of record and the seller of the subscription: when you subscribe
            you buy from Paddle, which processes your payment, charges taxes and issues your
            invoice, under Paddle&apos;s own buyer terms. A subscription renews automatically
            until you cancel it. You can cancel at any time from your account page, and your access
            continues until the end of the period you have paid for. See our{' '}
            <a href="/refund-policy">refund policy</a> for refunds.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Free trial</h2>
          <p>
            Every account gets a {PRO_PRICING.trialDays}-day free trial of AR mode. No card is needed, and the trial is
            available once per account. We may refuse a further trial if we see repeated sign-ups
            made to get around this limit.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Acceptable use</h2>
          <p>
            Do not resell access to the service, share your account, try to bypass the paywall, or
            send automated bulk requests that put a load on the service. Use AR mode only to look at
            screens you are entitled to watch, and do not point your camera at people without their
            consent.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Disclaimer and liability</h2>
          <p>
            Except where the law says otherwise, the service is provided as is, without warranties
            of any kind. To the extent the law allows, our liability is limited to the amount you
            paid us in the last 12 months. Nothing in these terms limits or excludes your statutory
            rights as a consumer, or any liability that cannot be limited or excluded by law,
            including liability for death or personal injury caused by negligence, for fraud, or
            for anything else the law does not allow us to exclude.
          </p>
        </section>

        {GOVERNING_LAW ? (
          <section className={s.slip}>
            <h2 className={`ds-display ${s.h2}`}>Governing law</h2>
            <p>
              These terms are governed by {GOVERNING_LAW}. If you are a consumer, you keep the
              protection of the mandatory consumer laws of the country where you live, and you may
              bring a claim in the courts of that country.
            </p>
          </section>
        ) : null}

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Changes</h2>
          <p>
            We may update these terms from time to time. The date of the latest change is shown at
            the top of this page.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Contact</h2>
          <p>
            Questions about these terms? Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
