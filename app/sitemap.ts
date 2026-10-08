import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://proffernando1.github.io/',
      lastModified: new Date('2026-09-06'),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://proffernando1.github.io/blog/',
      lastModified: new Date('2026-10-08'),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
