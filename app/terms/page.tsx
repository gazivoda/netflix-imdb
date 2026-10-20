import { pageMetadata } from '../../lib/seo';
import { SUPPORT_EMAIL } from '../../lib/content';
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
          Last updated: October 20, 2026
        </p>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Service</h2>
          <p>
            Rating Watch provides a free Chrome extension and a paid AR mode. Ratings come from the
            OMDb API and are provided as is. Rating Watch is not affiliated with Netflix, IMDb or
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
            Pro costs $2.99 per month or $29 per year, plus any taxes shown at checkout. Paddle is
            our merchant of record and processes your payment. A subscription renews automatically
            until you cancel it. You can cancel at any time from your account page, and your access
            continues until the end of the period you have paid for.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Free trial</h2>
          <p>
            Every account gets a 3-day free trial of AR mode. No card is needed, and the trial is
            available once per account.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Acceptable use</h2>
          <p>
            Do not scrape the service, resell access to it, or try to bypass the paywall.
          </p>
        </section>

        <section className={s.slip}>
          <h2 className={`ds-display ${s.h2}`}>Disclaimer and liability</h2>
          <p>
            The service is provided as is, without warranties of any kind. To the extent the law
            allows, our liability is limited to the amount you paid us in the last 12 months.
          </p>
        </section>

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
