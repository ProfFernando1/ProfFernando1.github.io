export default function Portrait({ hero = false }: { hero?: boolean }) {
  return (
    // These local WebP files are already sized for both static and Worker hosting.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`author-portrait${hero ? ' hero-portrait' : ''}`}
      src="/fernando-coelho-retrato.webp"
      srcSet="/fernando-coelho-retrato.webp 320w, /fernando-coelho-retrato-640.webp 640w"
      sizes={hero ? '(max-width: 620px) 80px, 96px' : '88px'}
      alt="Retrato de Fernando Coelho"
      width="320"
      height="400"
      loading={hero ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
