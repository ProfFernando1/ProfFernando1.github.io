import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://proffernando1.github.io/',
      lastModified: new Date('2026-08-22'),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
