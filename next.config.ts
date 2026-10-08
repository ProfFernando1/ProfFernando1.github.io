import type { NextConfig } from 'next';

const isGitHubPagesBuild =
  process.env.GITHUB_PAGES === 'true' ||
  process.env.npm_lifecycle_event === 'build:pages';

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      output: 'export',
      trailingSlash: true,
      pageExtensions: ['tsx', 'ts'],
    }
  : { pageExtensions: ['tsx', 'ts', 'site.ts'] };

export default nextConfig;
