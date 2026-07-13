import nextra from 'nextra'

const isGithubPages = process.env.GITHUB_PAGES === 'true'
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Docs'
const basePath = isGithubPages ? `/${repoName}` : ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true
  }
}

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false
  }
})

export default withNextra(nextConfig)
