import s from './ar-explainer.module.css'

// Plain server-renderable copy for /camera-vision/ar, shared by the AR page and the sign-in/paywall states so the URL
// carries the same real description whatever the visitor can see. Statements here must match what the code does:
// frames are analysed in the browser and never uploaded; only recognised title text goes to /api/ratings.
export default function ArExplainer() {
  return (
    <div className={s.explainer}>
      <section aria-labelledby="ar-what">
        <h2 id="ar-what" className={`ds-display ${s.h2}`}>What AR Ratings does</h2>
        <p>
          AR Ratings uses your phone camera to read a Netflix screen on a TV and draw IMDb and Rotten Tomatoes scores on top of
          each title card in the live view. It is a companion to the Rating Watch extension for the moments when the screen
          you are looking at is a TV rather than a browser.
        </p>
      </section>
      <section aria-labelledby="ar-how">
        <h2 id="ar-how" className={`ds-display ${s.h2}`}>How to use it</h2>
        <ol className={s.list}>
          <li>Open this page on your phone and start the camera. The rear camera is used.</li>
          <li>Line the TV screen up with the frame and hold steady. Dim rooms and glare on the glass make reading harder.</li>
          <li>Cards the app recognises show their scores. A dashed card has not been identified yet: tap it and type the title once, and the app remembers that card on this device.</li>
        </ol>
      </section>
      <section aria-labelledby="ar-privacy">
        <h2 id="ar-privacy" className={`ds-display ${s.h2}`}>Privacy</h2>
        <p>
          Camera images are processed on your device and are not uploaded or stored on our servers. Only the title text the
          app reads (or that you type) is sent to look up the ratings. The text-reading code and its language data are
          downloaded from the jsDelivr CDN when the camera starts, so jsDelivr can see your IP address.
        </p>
      </section>
      <section aria-labelledby="ar-reqs">
        <h2 id="ar-reqs" className={`ds-display ${s.h2}`}>Requirements and limits</h2>
        <ul className={s.list}>
          <li>A phone or tablet with a rear camera, and a browser that allows camera access on HTTPS pages.</li>
          <li>A TV showing the Netflix browse screen with title cards in view.</li>
          <li>AR mode is experimental. Recognition has been tuned on test images and is not yet measured across many real TVs, so some cards may stay unlabelled and scores can be missing.</li>
        </ul>
      </section>
    </div>
  )
}
