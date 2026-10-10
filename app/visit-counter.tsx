'use client';

import { useState, useSyncExternalStore } from 'react';

const counters = {
  home: { path: 'proffernando1.github.io', label: 'Acessos', alt: 'Contador de acessos à página' },
  blog: { path: 'proffernando1.github.io/blog', label: 'Acessos ao blog', alt: 'Contador de acessos ao blog' },
};
const subscribe = () => () => {};
const getServerSnapshot = () => false;
const isPublishedSite = () =>
  window.location.hostname === 'proffernando1.github.io' ||
  window.location.hostname.endsWith('.chatgpt.site');

export default function VisitCounter({ page = 'home' }: { page?: keyof typeof counters }) {
  const published = useSyncExternalStore(subscribe, isPublishedSite, getServerSnapshot);
  const [failed, setFailed] = useState(false);
  const counter = counters[page];
  const counterUrl = `https://hits.sh/${counter.path}.svg?label=${encodeURIComponent(counter.label)}&color=496616&labelColor=17231f&style=flat`;

  return (
    <div className="visit-counter">
      {published && !failed ? (
        // Keep the SVG request in the visitor's browser: image optimization would cache the counter.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={counterUrl}
          alt={counter.alt}
          title="Acessos desde a ativação do contador"
          height="24"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{failed ? 'Contador temporariamente indisponível' : `${counter.label} · prévia local`}</span>
      )}
    </div>
  );
}
