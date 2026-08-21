import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'CoSet Docs',
    template: '%s – CoSet Docs'
  },
  description:
    'CoSet documentation for hedge fund and fund admin ops: automate SFTP, email, SQL, Geneva, and Bloomberg workflows; Credential Hub; warehouses and views; period-close checklists; Public API.',
  applicationName: 'CoSet Docs',
  keywords: [
    'CoSet',
    'workflow automation',
    'hedge fund operations',
    'fund administrator',
    'SFTP',
    'Credential Hub',
    'data monitors',
    'period close checklist',
    'Geneva',
    'Bloomberg'
  ]
}

const navbar = (
  <Navbar
    logo={<b>CoSet Docs</b>}
    projectLink="https://github.com/cosethub/Docs"
  />
)

const footer = (
  <Footer>
    {new Date().getFullYear()} © CoSet ·{' '}
    <a href="https://www.cosethub.com">cosethub.com</a>
  </Footer>
)

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
