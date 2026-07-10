import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'Docs',
    template: '%s – Docs'
  },
  description: 'Documentation site built with Nextra'
}

const navbar = (
  <Navbar
    logo={<b>Docs</b>}
    projectLink="https://github.com/cosethub/Docs"
  />
)

const footer = <Footer>MIT {new Date().getFullYear()} © Docs.</Footer>

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/cosethub/Docs/tree/main"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
