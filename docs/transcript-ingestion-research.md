# Transcript Ingestion Platform Constraints

SoulCut accepts creator-provided transcript files for public video URLs because official source-platform APIs impose ownership-based access controls. The uploaded transcript remains private to the authenticated creator and is treated as untrusted source data during analysis.

| Platform | Verified capability | Product implication |
|---|---|---|
| YouTube | The Data API can list caption tracks, but downloading a caption track requires authorization with a scope that permits editing the video. | SoulCut does not claim it can automatically retrieve captions for arbitrary public YouTube URLs. Creators can import an exported `.txt`, `.srt`, or `.vtt` transcript. |
| Vimeo | Vimeo documents text-track download links, but transcript access requires a personal token from the owner account of the video. | SoulCut accepts an owner-exported transcript file instead of attempting unauthenticated access to a private Vimeo transcript. |

## Sources

- [YouTube Data API — Captions](https://developers.google.com/youtube/v3/docs/captions)
- [YouTube Data API — Captions: download](https://developers.google.com/youtube/v3/docs/captions/download)
- [Vimeo — Access and download video transcripts via API](https://help.vimeo.com/hc/en-us/articles/17480150130833-How-to-access-and-download-video-transcripts-via-API)
- [Vimeo API — Text Track response](https://developer.vimeo.com/api/reference/response/text-track)
