'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createWorker } from 'tesseract.js'
import { extractMovieTitles, wordsFromBlocks } from '@/lib/extract-titles'
import { binarizeForOcr } from '@/lib/ocr-preprocess'
import { ImdbChip, RtChip } from '@/components/ScoreChip'
import { AR_LINK_LABEL } from '@/components/billing/pricing-state'
import s from './camera.module.css'

interface DetectedContent {
  id: string
  title: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
  rating?: number
  voteCount?: number
  rtRating?: number | null
}

const OCR_SCALE = 3
const OCR_INTERVAL_MS = 3000

function preprocessFrame(source: HTMLVideoElement): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = source.videoWidth * OCR_SCALE
  canvas.height = source.videoHeight * OCR_SCALE

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  if (!binarizeForOcr(imageData.data)) return null
  ctx.putImageData(imageData, 0, 0)

  return canvas
}

export default function CameraVision() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showOverlays, setShowOverlays] = useState(true)
  const [detectedContent, setDetectedContent] = useState<DetectedContent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastProcessedTime, setLastProcessedTime] = useState(0)
  const ocrWorkerRef = useRef<any>(null)
  const ocrFailureCountRef = useRef(0)
  const lastRunRef = useRef(0)
  const [ocrReady, setOcrReady] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [ocrFailureCount, setOcrFailureCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Status counters are for tuning, not for visitors: they show only on /camera-vision?debug=1.
  const [debugAllowed, setDebugAllowed] = useState(false)
  useEffect(() => { setDebugAllowed(new URLSearchParams(window.location.search).get('debug') === '1') }, [])

  useEffect(() => {
    let cancelled = false
    createWorker('eng').then(async worker => {
      await worker.setParameters({
        tessedit_pageseg_mode: 11 as any,
      })
      if (!cancelled) {
        ocrWorkerRef.current = worker
        setOcrReady(true)
      } else {
        worker.terminate()
      }
    })
    return () => {
      cancelled = true
      ocrWorkerRef.current?.terminate()
      ocrWorkerRef.current = null
    }
  }, [])

  const startCamera = async () => {
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: 'environment' // Use back camera on mobile
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsStreaming(true)
        setVideoLoaded(false) // Reset video loaded state
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setErrorMessage('Camera access denied. Please allow camera permissions and try again.')
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsStreaming(false)
      setVideoLoaded(false)
      setDetectedContent([])
      setIsProcessing(false)
      setOcrFailureCount(0) // Reset failure count
      ocrFailureCountRef.current = 0
    }
  }

  const fetchRatings = async (titles: string[]) => {
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ titles }),
      })

      if (response.ok) {
        const ratings = await response.json()
        return ratings
      }
    } catch (err) {
      console.error('Error fetching ratings:', err)
    }
    return []
  }

  // Process video frame for OCR
  const processVideoFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !ocrWorkerRef.current || isProcessing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return

    // Throttle on a ref: the rAF loop holds stale state between renders and would re-enter back-to-back.
    if (Date.now() - lastRunRef.current < OCR_INTERVAL_MS) return
    lastRunRef.current = Date.now()

    setIsProcessing(true)

    try {
      const preprocessed = preprocessFrame(video)
      if (!preprocessed) {
        console.warn('Frame has no contrast, skipping OCR')
        return
      }

      const { data } = await ocrWorkerRef.current.recognize(preprocessed, {}, { blocks: true })
      const words = wordsFromBlocks(data.blocks)

      setOcrFailureCount(0)
      ocrFailureCountRef.current = 0

      const detectedTitles = extractMovieTitles(words, OCR_SCALE)

      const newContent: DetectedContent[] = detectedTitles.map((title, index) => ({
        id: `detected-${Date.now()}-${index}`,
        title: title.title,
        confidence: title.confidence,
        x: ((title.x ?? 20) / video.videoWidth) * 100,
        y: ((title.y ?? (20 + index * 90)) / video.videoHeight) * 100,
        width: 200,
        height: 80,
      }))

      setDetectedContent(newContent)

      // Fetch ratings for detected titles
      if (newContent.length > 0) {
        const titles = newContent.map(content => content.title)
        const ratings = await fetchRatings(titles)

        setDetectedContent(prev =>
          prev.map(content => {
            const rating = ratings.find((r: any) => r.query === content.title)
            return rating && rating.found
              ? { ...content, rating: rating.rating, voteCount: rating.voteCount, rtRating: rating.rtRating }
              : content
          })
        )
      }

    } catch (error) {
      console.error('OCR processing error:', error)
      ocrFailureCountRef.current += 1
      setOcrFailureCount(ocrFailureCountRef.current)

      if (ocrFailureCountRef.current >= 5) {
        console.error('Too many OCR failures, stopping processing')
        stopCamera()
        setErrorMessage('OCR processing failed too many times. Please check your camera and try again.')
        return
      }
    } finally {
      setIsProcessing(false)
      setLastProcessedTime(Date.now())
    }
  }, [ocrWorkerRef, isProcessing])

  // Process frames periodically with better performance
  useEffect(() => {
    if (!isStreaming || !ocrReady || !videoLoaded) return

    let animationFrame: number

    const processFrame = async () => {
      const timeSinceLastProcess = Date.now() - lastProcessedTime
      if (timeSinceLastProcess > OCR_INTERVAL_MS && !isProcessing) { // Process every 3 seconds
        await processVideoFrame()
      }
      animationFrame = requestAnimationFrame(processFrame)
    }

    animationFrame = requestAnimationFrame(processFrame)

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [isStreaming, ocrReady, videoLoaded, processVideoFrame, lastProcessedTime, isProcessing])

  return (
    <main id="main" tabIndex={-1} className={s.main}>
      {/* Header */}
      <div className={s.head}>
        <div className={s.headText}>
          <Link
            href="/"
            className={s.back}
          >
            ← Back to Home
          </Link>
          <h1 className={`ds-display ${s.title}`}>Camera Vision <em className="ds-serif">Demo</em></h1>
          <p className={s.sub}>
            Real-time OCR text detection and movie title recognition
            {isProcessing && <span className={s.processing}><span className={`${s.dot} ${s.dotLive}`} aria-hidden />Processing...</span>}
          </p>
        </div>

        <div className={s.actions}>
          <Link href="/camera-vision/ar" className={`ds-btn ${s.btn}`}>
            {AR_LINK_LABEL}
          </Link>
          {!isStreaming ? (
            <button
              onClick={startCamera}
              className={`ds-btn ds-btn-signal ${s.btn}`}
            >
              Start Camera
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className={`ds-btn ${s.btn} ${s.btnInk}`}
            >
              Stop Camera
            </button>
          )}

          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className={`ds-btn ${s.btn} ${showOverlays ? '' : s.btnTeal}`}
          >
            {showOverlays ? 'Hide Overlays' : 'Show Overlays'}
          </button>
        </div>
      </div>

      {errorMessage && <p className={s.error} role="alert">{errorMessage}</p>}

      {/* Camera View */}
      <div className={s.stage}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={s.video}
          onLoadedData={() => {
            setVideoLoaded(true)
          }}
        />

        <canvas
          ref={canvasRef}
          className={s.canvas}
          style={{ display: 'none' }} // Hidden, used for processing only
        />

        {/* Rating Overlays */}
        {showOverlays && detectedContent.map((content) => (
          <div
            key={content.id}
            className={s.overlay}
            style={{
              left: `${content.x}%`,
              top: `${content.y}%`,
            }}
          >
            <div className={s.overlayTitle}>{content.title}</div>
            <div className={`ds-label ${s.overlayMeta}`}>
              Confidence: {content.confidence.toFixed(1)}%
            </div>
            {content.rating != null ? (
              <div className={s.scoreRow}>
                <ImdbChip value={content.rating.toFixed(1)} />
                {content.voteCount && (
                  <div className={s.votes}>
                    ({content.voteCount.toLocaleString()} votes)
                  </div>
                )}
              </div>
            ) : (
              <div className={s.pending}>Loading rating...</div>
            )}
            {content.rtRating != null && (
              <div className={s.scoreRow}>
                <RtChip value={`${content.rtRating}%`} />
              </div>
            )}
          </div>
        ))}

        {!isStreaming && (
          <div className={s.idle}>
            <div className={s.idleInner}>
              <div className={s.idleMark} aria-hidden />
              <div className={`ds-display ${s.idleTitle}`}>Camera not active</div>
              <p className={s.idleHint}>
                Click "Start Camera" to begin OCR text detection
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Server-rendered explanation: what the demo does, how to use it, privacy, requirements. */}
      <div className={`ds-card ${s.panel}`}>
        <section aria-labelledby="cv-what">
          <h2 id="cv-what" className={`ds-display ${s.aboutTitle}`}>What Camera Vision does</h2>
          <p className={s.aboutBody}>
            Camera Vision is a demo of the text reading behind Rating Watch AR mode. It reads text from your camera feed, picks out
            what looks like a movie or series title, and shows the IMDb and Rotten Tomatoes scores for it over the live view.
          </p>
        </section>
        <section aria-labelledby="cv-how">
          <h2 id="cv-how" className={`ds-display ${s.aboutTitle}`}>How to use it</h2>
          <ol className={s.aboutList}>
            <li>Press Start Camera and allow camera access when your browser asks.</li>
            <li>Point the camera at a screen, poster or printed text with a clear title and hold it steady for a few seconds.</li>
            <li>Detected titles appear over the video with their ratings. Use Hide Overlays to remove them.</li>
          </ol>
          <p className={s.aboutBody}>
            For a TV showing the Netflix browse screen, with a frame to line up and ratings on every card, use <Link href="/camera-vision/ar">AR Ratings</Link>.
          </p>
        </section>
        <section aria-labelledby="cv-privacy">
          <h2 id="cv-privacy" className={`ds-display ${s.aboutTitle}`}>Privacy</h2>
          <p className={s.aboutBody}>
            Camera images are processed on your device and are not uploaded or stored on our servers. Only the title text that was read is
            sent to look up its ratings. The text-reading code and its language data are downloaded from the jsDelivr CDN when the page loads,
            so jsDelivr can see your IP address.
          </p>
        </section>
        <section aria-labelledby="cv-reqs">
          <h2 id="cv-reqs" className={`ds-display ${s.aboutTitle}`}>Requirements</h2>
          <ul className={s.aboutList}>
            <li>A device with a camera and a browser that allows camera access on HTTPS pages.</li>
            <li>Titles in clear, well-lit, in-focus text. Reading is slower on small or stylised lettering.</li>
          </ul>
        </section>
      </div>

      {/* Info Panel */}
      <div className={`ds-card ${s.panel}`}>
        <h2 className={`ds-display ${s.panelTitle}`}>Real-Time OCR Processing</h2>
        <div className={s.features}>
          <div className={s.feature}>
            <h3 className={s.featureHead}>Text Detection</h3>
            <p className={s.featureBody}>
              Uses Tesseract.js OCR to detect and read text from your camera feed.
              Processes video frames every 3 seconds for optimal performance.
            </p>
          </div>

          <div className={s.feature}>
            <h3 className={s.featureHead}>Title Recognition</h3>
            <p className={s.featureBody}>
              Identifies potential movie/TV show titles using pattern matching.
              Filters out UI elements and focuses on capitalized title patterns.
            </p>
          </div>

          <div className={s.feature}>
            <h3 className={s.featureHead}>Live Ratings</h3>
            <p className={s.featureBody}>
              Automatically fetches IMDb ratings for detected titles.
              Shows confidence scores and vote counts for transparency.
            </p>
          </div>

          <div className={s.feature}>
            <h3 className={s.featureHead}>Point & Scan</h3>
            <p className={s.featureBody}>
              Point your camera at Netflix (or any streaming service) and watch
              ratings appear in real-time as titles are detected.
            </p>
          </div>
        </div>

        {/* Testing Instructions */}
        <div className={s.test}>
          <h3 className={s.testHead}>How to Test OCR</h3>
          <div className={s.testBody}>
            <p><strong>1.</strong> Point your camera at a computer screen or printed text</p>
            <p><strong>2.</strong> Make sure text is clear, well-lit, and in focus</p>
            <p><strong>3.</strong> Hold steady for 3-5 seconds while OCR processes</p>
            <p><strong>4.</strong> Detected titles appear over the camera view</p>
            <p><strong>5.</strong> Try with movie posters, Netflix interface, or title cards</p>
          </div>
        </div>
      </div>

      {/* Debug Info (?debug=1 only) */}
      {debugAllowed && <div className={`ds-card ${s.debug}`}>
        <h3 className={s.debugHead}>Debug Information</h3>
        <div className={s.debugRows}>
          <div><span className={`${s.dot} ${isStreaming ? s.dotLive : ''}`} aria-hidden />Status: {isStreaming ? 'Camera Active' : 'Camera Inactive'}</div>
          <div><span className={`${s.dot} ${ocrReady ? s.dotReady : ''}`} aria-hidden />OCR Worker: {ocrReady ? 'Ready' : 'Loading...'}</div>
          <div><span className={`${s.dot} ${videoLoaded ? s.dotReady : ''}`} aria-hidden />Video Loaded: {videoLoaded ? 'Ready' : 'Loading...'}</div>
          <div><span className={`${s.dot} ${isProcessing ? s.dotLive : ''}`} aria-hidden />Processing: {isProcessing ? 'Active' : 'Idle'}</div>
          <div className={s.noDot}>Detected Titles: {detectedContent.length}</div>
          <div className={s.noDot}>OCR Failures: {ocrFailureCount}</div>
          <div className={s.noDot}>Last Process: {lastProcessedTime ? new Date(lastProcessedTime).toLocaleTimeString() : 'Never'}</div>
        </div>
      </div>}

      {/* Status */}
      <p className={s.foot}>
        Point your camera at a screen showing Netflix or movie titles to see real-time OCR detection in action!
      </p>
    </main>
  )
}
