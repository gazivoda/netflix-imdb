'use client';
// Click-to-play promo video. preload="none" keeps the 4.6 MB mp4 off the page load entirely:
// nothing but the poster is fetched until the visitor presses play.
import { useRef, useState } from 'react';
import styles from './PromoVideo.module.css';
import { PROMO_VIDEO } from '../../lib/promo-video';

export default function PromoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    // Called from a click, so the browser allows playback with sound.
    video.play().catch((error) => {
      console.error('Error playing video:', error);
      setStarted(false);
    });
  };

  const handleEnded = () => {
    if (videoRef.current) videoRef.current.currentTime = 0;
    setStarted(false);
  };

  return (
    <section className={styles.promo} aria-labelledby="promo-title">
      <p className={styles.label}>Overview</p>
      <h2 id="promo-title" className={styles.title}>
        Rating Watch in <em>30 seconds</em>
      </h2>
      <figure className={styles.figure}>
        <div className={styles.frame}>
          <video
            ref={videoRef}
            className={styles.video}
            src={PROMO_VIDEO.src}
            poster={PROMO_VIDEO.poster}
            preload="none"
            playsInline
            controls={started}
            onEnded={handleEnded}
            aria-label={PROMO_VIDEO.title}
          />
          {!started && (
            <button
              type="button"
              className={styles.play}
              onClick={handlePlay}
              aria-label={`Play video: ${PROMO_VIDEO.title}`}
            >
              <span className={styles.playIcon} aria-hidden>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" focusable="false">
                  <path d="M6 4l14 8-14 8z" />
                </svg>
              </span>
              <span className={styles.playLabel}>{PROMO_VIDEO.playLabel}</span>
            </button>
          )}
        </div>
        <figcaption className={styles.caption}>{PROMO_VIDEO.caption}</figcaption>
      </figure>
    </section>
  );
}
