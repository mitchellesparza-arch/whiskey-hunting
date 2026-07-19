/**
 * Shared helper for deleting Vercel Blob objects once the record that
 * references them (a find, collection entry, or marketplace listing) is
 * removed or expires. Without this, uploaded photos are never cleaned up
 * and Blob storage usage only ever grows.
 *
 * Only ever attempts to delete URLs that actually point at our Blob store —
 * collection photos, for example, can also point at Algolia/UA catalog
 * images we never uploaded, and those must be left alone.
 *
 * Never throws — a failed cleanup must never block the caller's main
 * operation (removing the record itself already succeeded by the time
 * this runs). Callers must still `await` it (not fire-and-forget) since
 * Vercel can freeze the function right after the response is sent.
 */
export async function deleteBlobPhotos(urls) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return

  const list = (Array.isArray(urls) ? urls : [urls])
    .filter(u => typeof u === 'string' && u.includes('.blob.vercel-storage.com'))

  if (!list.length) return

  try {
    const { del } = await import('@vercel/blob')
    await del(list)
  } catch (err) {
    console.warn('[blob-cleanup] delete failed:', err?.message ?? err)
  }
}
