import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://portalgerenciavel.digitalarea.online';

  const staticRoutes = [
    { url: `${BASE_URL}/`, priority: 1.0, changeFrequency: 'weekly' as const },
    { url: `${BASE_URL}/sobre`, priority: 0.8, changeFrequency: 'monthly' as const },
    { url: `${BASE_URL}/catalogo`, priority: 0.9, changeFrequency: 'daily' as const },
    { url: `${BASE_URL}/encontre-seu-cheiro`, priority: 0.7, changeFrequency: 'monthly' as const },
    { url: `${BASE_URL}/galeria`, priority: 0.7, changeFrequency: 'weekly' as const },
  ];

  return staticRoutes.map(route => ({
    ...route,
    lastModified: new Date(),
  }));
}
