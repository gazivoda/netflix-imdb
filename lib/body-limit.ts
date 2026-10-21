// Reads a request body as text without ever buffering more than `max` bytes. The declared content-length is
// checked first (cheap early exit); the stream is counted as well, because the header can be absent or wrong.
// Resolves to null when the body is larger than `max`.
export async function readCappedText(req: Request, max: number): Promise<string | null> {
  const declared = req.headers.get('content-length')
  if (declared !== null && Number(declared) > max) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      void reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks)) // same decoding as Request.text()
}
