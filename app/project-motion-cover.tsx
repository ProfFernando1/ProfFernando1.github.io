'use client';

import {useEffect, useRef, useState} from 'react';

export default function ProjectMotionCover({poster, source, alt}: {
  poster: string;
  source: string;
  alt: string;
}) {
  const coverRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const cover = coverRef.current;
    const video = videoRef.current;
    if (!cover || !video || typeof IntersectionObserver === 'undefined') return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let failed = false;

    function syncPlayback() {
      if (!video) return;
      if (!visible || motion.matches) {
        video.pause();
        return;
      }
      if (failed || video.ended || !video.paused) return;
      video.muted = true;
      if (!video.getAttribute('src')) video.src = source;
      void video.play().catch(() => {
        if (video.error) failed = true;
      });
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= 0.4;
      syncPlayback();
    }, {threshold: [0.4]});
    observer.observe(cover);
    motion.addEventListener('change', syncPlayback);

    return () => {
      observer.disconnect();
      motion.removeEventListener('change', syncPlayback);
      video.pause();
    };
  }, [source]);

  return (
    <div className="project-preview project-preview-motion" ref={coverRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt={alt} width="960" height="600" loading="lazy" decoding="async" />
      <video
        ref={videoRef}
        className={showVideo ? 'is-visible' : undefined}
        width="960"
        height="600"
        muted
        playsInline
        preload="none"
        aria-hidden="true"
        onPlaying={() => setShowVideo(true)}
        onError={() => setShowVideo(false)}
      />
    </div>
  );
}
