/** Read-only presentation fallback for an existing, validated YouTube video ID. */
export function monitorVideoThumbnail(video) {
  return video.thumbnail_url || (/^[A-Za-z0-9_-]{11}$/.test(video.video_id)
    ? `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg` : null);
}
