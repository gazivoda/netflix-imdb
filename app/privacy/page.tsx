export const metadata = {
  title: 'Privacy Policy — Netflix IMDB Ratings',
};

export default function PrivacyPage() {
  return (
    <main style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '64px 32px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#f5f5f1',
      background: '#0a0a0a',
      minHeight: '100vh',
      lineHeight: 1.7,
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 48 }}>
        Last updated: May 4, 2025
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>What this extension does</h2>
        <p style={{ color: '#bbb' }}>
          Netflix IMDB Ratings is a Chrome extension that reads the title of each Netflix show or
          movie visible on your screen and fetches its IMDB rating from the OMDb public API. The
          rating is then displayed as a small badge on the title card.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Data we send to third parties</h2>
        <p style={{ color: '#bbb', marginBottom: 12 }}>
          The only data transmitted outside your browser is the <strong>title name</strong> of each
          Netflix show or movie (e.g. &quot;Stranger Things&quot;). This is sent to the{' '}
          <a href="https://www.omdbapi.com" style={{ color: '#E50914' }} target="_blank" rel="noopener noreferrer">
            OMDb API
          </a>{' '}
          solely to retrieve the IMDB rating. No other information is included in these requests.
        </p>
        <p style={{ color: '#bbb' }}>
          Title names are extracted from the <code style={{ background: '#222', padding: '1px 5px', borderRadius: 3 }}>aria-label</code> attributes
          that Netflix already places on its title card links. We do not read, store, or transmit
          your Netflix watch history, account details, or any personally identifiable information.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Data we do NOT collect</h2>
        <ul style={{ color: '#bbb', paddingLeft: 20 }}>
          <li>No personally identifiable information</li>
          <li>No browsing history beyond the current Netflix page</li>
          <li>No Netflix account details, cookies, or session tokens</li>
          <li>No analytics or telemetry of any kind</li>
          <li>No data is stored on any server — there is no backend</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Local caching</h2>
        <p style={{ color: '#bbb' }}>
          Ratings fetched during a browser session are cached in memory (inside the extension&apos;s
          background service worker) to avoid duplicate API calls. This cache is cleared automatically
          when the service worker is terminated and is never written to disk or synced anywhere.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Third-party services</h2>
        <p style={{ color: '#bbb' }}>
          This extension uses the{' '}
          <a href="https://www.omdbapi.com" style={{ color: '#E50914' }} target="_blank" rel="noopener noreferrer">
            OMDb API
          </a>{' '}
          to retrieve IMDB ratings. Please refer to OMDb&apos;s own privacy policy for information on
          how they handle API requests.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Permissions</h2>
        <p style={{ color: '#bbb', marginBottom: 8 }}>
          The extension requests the following host permissions:
        </p>
        <ul style={{ color: '#bbb', paddingLeft: 20 }}>
          <li>
            <strong>https://www.netflix.com/*</strong> — required to inject the content script that
            reads title card labels and displays rating badges on the Netflix interface.
          </li>
          <li style={{ marginTop: 8 }}>
            <strong>https://www.omdbapi.com/*</strong> — required to fetch IMDB ratings from the
            OMDb API from the background service worker.
          </li>
        </ul>
        <p style={{ color: '#bbb', marginTop: 12 }}>
          No other permissions are requested. The extension does not request access to tabs,
          browsing history, storage, or any other browser APIs.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Contact</h2>
        <p style={{ color: '#bbb' }}>
          Questions about this privacy policy? Reach out at{' '}
          <a href="mailto:gazivodai61@gmail.com" style={{ color: '#E50914' }}>
            gazivodai61@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
