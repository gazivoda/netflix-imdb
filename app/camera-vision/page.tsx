'use client'

import '../globals.css'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createWorker } from 'tesseract.js'

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
  const [ocrReady, setOcrReady] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [ocrFailureCount, setOcrFailureCount] = useState(0)

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
      alert('Camera access denied. Please allow camera permissions and try again.')
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

    setIsProcessing(true)

    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Validate canvas has content
      const imageData = ctx.getImageData(0, 0, 1, 1) // Check a single pixel
      if (imageData.data.every(pixel => pixel === 0)) {
        console.warn('Canvas appears empty, skipping OCR')
        return
      }

      // Perform OCR on the canvas directly (more reliable than ImageData)
      const { data: { text, confidence, words } } = await ocrWorkerRef.current.recognize(canvas)

      // Reset failure count on success
      setOcrFailureCount(0)

      // Process detected text
      const detectedTitles = extractMovieTitles(text, words)
      console.log('Detected text:', text)
      console.log('Extracted titles:', detectedTitles)

      // Update detected content
      const newContent: DetectedContent[] = detectedTitles.map((title, index) => ({
        id: `detected-${Date.now()}-${index}`,
        title: title.title,
        confidence: title.confidence,
        x: title.x || Math.random() * (canvas.width - 200),
        y: title.y || Math.random() * (canvas.height - 100),
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
              ? { ...content, rating: rating.rating, voteCount: rating.voteCount }
              : content
          })
        )
      }

    } catch (error) {
      console.error('OCR processing error:', error)
      setOcrFailureCount(prev => prev + 1)
      
      // Stop processing after too many failures
      if (ocrFailureCount >= 5) {
        console.error('Too many OCR failures, stopping processing')
        setIsStreaming(false)
        setDetectedContent([])
        setIsProcessing(false)
        alert('OCR processing failed too many times. Please check your camera and try again.')
        return
      }
    } finally {
      setIsProcessing(false)
      setLastProcessedTime(Date.now())
    }
  }, [ocrWorkerRef, isProcessing])

  // Extract movie titles from OCR text
  const extractMovieTitles = (text: string, words: any[]) => {
    // Validate inputs
    if (!text || typeof text !== 'string') return []
    if (!words || !Array.isArray(words)) return []
    
    const titles: Array<{title: string, confidence: number, x?: number, y?: number}> = []

    // Common movie title patterns
    const titlePatterns = [
      // Capitalized words (typical movie titles)
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
      // Title case patterns
      /\b(?:The|A|An)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
    ]

    const lines = text.split('\n').filter(line => line.trim().length > 3)

    for (const line of lines) {
      for (const pattern of titlePatterns) {
        const matches = line.match(pattern)
        if (matches) {
          for (const match of matches) {
            // Filter out common UI text
            if (!/^(Home|TV Shows|Movies|Search|Menu|Play|Watch|More|Like|This|New)$/i.test(match)) {
              // Find position information
              const wordData = words.find(w => w.text.includes(match) || match.includes(w.text))
              titles.push({
                title: match,
                confidence: wordData?.confidence || 50,
                x: wordData?.bbox?.x0,
                y: wordData?.bbox?.y0,
              })
            }
          }
        }
      }
    }

    // Remove duplicates and filter by confidence
    const uniqueTitles = titles
      .filter(title => title.confidence > 30)
      .filter((title, index, self) =>
        index === self.findIndex(t => t.title === title.title)
      )
      .slice(0, 3) // Limit to top 3 detections

    return uniqueTitles
  }

  // Process frames periodically with better performance
  useEffect(() => {
    if (!isStreaming || !ocrReady || !videoLoaded) return

    let animationFrame: number

    const processFrame = async () => {
      const timeSinceLastProcess = Date.now() - lastProcessedTime
      if (timeSinceLastProcess > 3000 && !isProcessing) { // Process every 3 seconds
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
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold">Camera Vision Demo</h1>
            <p className="text-gray-400">
              Real-time OCR text detection and movie title recognition
              {isProcessing && <span className="ml-2 text-yellow-400">⟳ Processing...</span>}
            </p>
          </div>

          <div className="flex gap-4">
            {!isStreaming ? (
              <button
                onClick={startCamera}
                className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Stop Camera
              </button>
            )}

            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                showOverlays
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {showOverlays ? 'Hide Overlays' : 'Show Overlays'}
            </button>
          </div>
        </div>

        {/* Camera View */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-8" style={{ height: '480px' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            onLoadedData={() => {
              console.log('Video loaded and ready')
              setVideoLoaded(true)
            }}
          />

          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ display: 'none' }} // Hidden, used for processing only
          />

          {/* Rating Overlays */}
          {showOverlays && detectedContent.map((content) => (
            <div
              key={content.id}
              className="absolute bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-purple-500 shadow-lg"
              style={{
                left: content.x || Math.random() * 60 + '%',
                top: content.y || Math.random() * 60 + '%',
                minWidth: '180px',
              }}
            >
              <div className="text-sm font-medium text-white mb-1">{content.title}</div>
              <div className="text-xs text-gray-400 mb-2">
                Confidence: {content.confidence.toFixed(1)}%
              </div>
              {content.rating ? (
                <div className="flex items-center gap-2">
                  <div className="text-yellow-400 text-lg">⭐</div>
                  <div className="text-white font-bold">{content.rating.toFixed(1)}</div>
                  {content.voteCount && (
                    <div className="text-gray-400 text-xs">
                      ({content.voteCount.toLocaleString()} votes)
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Loading rating...</div>
              )}
            </div>
          ))}

          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📹</div>
                <div className="text-xl text-gray-400">Camera not active</div>
                <div className="text-sm text-gray-500 mt-2">
                  Click "Start Camera" to begin OCR text detection
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Real-Time OCR Processing</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-400 mb-2">🔍 Text Detection</h4>
              <p className="text-gray-300 text-sm">
                Uses Tesseract.js OCR to detect and read text from your camera feed.
                Processes video frames every 3 seconds for optimal performance.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-purple-400 mb-2">🎬 Title Recognition</h4>
              <p className="text-gray-300 text-sm">
                Identifies potential movie/TV show titles using pattern matching.
                Filters out UI elements and focuses on capitalized title patterns.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-green-400 mb-2">⚡ Live Ratings</h4>
              <p className="text-gray-300 text-sm">
                Automatically fetches IMDB ratings for detected titles.
                Shows confidence scores and vote counts for transparency.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-orange-400 mb-2">📱 Point & Scan</h4>
              <p className="text-gray-300 text-sm">
                Point your camera at Netflix (or any streaming service) and watch
                ratings appear in real-time as titles are detected.
              </p>
            </div>
          </div>

          {/* Testing Instructions */}
          <div className="mt-6 border-t border-gray-700 pt-4">
            <h4 className="font-medium text-yellow-400 mb-2">🧪 How to Test OCR</h4>
            <div className="text-sm text-gray-300 space-y-2">
              <p><strong>1.</strong> Point your camera at a computer screen or printed text</p>
              <p><strong>2.</strong> Make sure text is clear, well-lit, and in focus</p>
              <p><strong>3.</strong> Hold steady for 3-5 seconds while OCR processes</p>
              <p><strong>4.</strong> Check browser console (F12) for detected text output</p>
              <p><strong>5.</strong> Try with movie posters, Netflix interface, or title cards</p>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-yellow-400 mb-2">Debug Information</h4>
          <div className="text-sm text-gray-400 space-y-1">
            <div>Status: {isStreaming ? '🟢 Camera Active' : '🔴 Camera Inactive'}</div>
            <div>OCR Worker: {ocrReady ? '✅ Ready' : '⏳ Loading...'}</div>
            <div>Video Loaded: {videoLoaded ? '✅ Ready' : '⏳ Loading...'}</div>
            <div>Processing: {isProcessing ? '⟳ Active' : '⏸️ Idle'}</div>
            <div>Detected Titles: {detectedContent.length}</div>
            <div>OCR Failures: {ocrFailureCount}</div>
            <div>Last Process: {lastProcessedTime ? new Date(lastProcessedTime).toLocaleTimeString() : 'Never'}</div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 text-center text-gray-400">
          <div className="text-sm">
            Point your camera at a screen showing Netflix or movie titles to see real-time OCR detection in action!
          </div>
        </div>
      </div>
    </div>
  )
}