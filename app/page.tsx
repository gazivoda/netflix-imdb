import styles from './page.module.css';
import { pageMetadata, faqPage, graph } from '../lib/seo';
import JsonLd from '../components/JsonLd';
import { FAQS } from '../lib/content';
import HomeNav from '../components/home/HomeNav';
import Hero from '../components/home/Hero';
import Stats from '../components/home/Stats';
import Marquee from '../components/home/Marquee';
import Story from '../components/home/Story';
import BeforeAfter from '../components/home/BeforeAfter';
import Features from '../components/home/Features';
import HowItWorks from '../components/home/HowItWorks';
import Testimonials from '../components/home/Testimonials';
import CompareCta from '../components/home/CompareCta';
import Faq from '../components/home/Faq';
import FinalCta from '../components/home/FinalCta';
import HomeFooter from '../components/home/HomeFooter';

export const metadata = pageMetadata('/');

export default function Page() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">Skip to main content</a>
      {/* FAQPage schema lives only here — it must match the visible FAQ on this page */}
      <JsonLd data={graph(faqPage(FAQS))} />
      <HomeNav />

      <main id="main" tabIndex={-1}>
        <Hero />
        <Stats />
        <Marquee />
        <Story />
        <BeforeAfter />
        <Features />
        <HowItWorks />
        <Testimonials />
        <CompareCta />
        <Faq />
        <FinalCta />
      </main>

      <HomeFooter />
    </div>
  );
}
