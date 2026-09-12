'use client';

import { useState, useSyncExternalStore } from 'react';

const counterUrl = 'https://hits.sh/proffernando1.github.io.svg?label=Acessos&color=496616&labelColor=17231f&style=flat';
const subscribe = () => () => {};
const getServerSnapshot = () => false;
const isPublishedSite = () =>
  window.location.hostname === 'proffernando1.github.io' ||
  window.location.hostname.endsWith('.chatgpt.site');

export default function VisitCounter() {
  const published = useSyncExternalStore(subscribe, isPublishedSite, getServerSnapshot);
  const [failed, setFailed] = useState(false);

  return (
    <div className="visit-counter">
      {published && !failed ? (
        // Keep the SVG request in the visitor's browser: image optimization would cache the counter.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={counterUrl}
          alt="Contador de acessos à página"
          title="Acessos desde a ativação do contador"
          height="24"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{failed ? 'Contador temporariamente indisponível' : 'Acessos · prévia local'}</span>
      )}
    </div>
  );
}
