import { Helmet } from "react-helmet-async";

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://mexicocharts.replit.app";
const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;

interface PageSEOProps {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  type?: "website" | "article";
  noindex?: boolean;
}

export default function PageSEO({ title, description, path = "/", ogImage = OG_IMAGE, type = "website", noindex = false }: PageSEOProps) {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = title.includes("Mexico Charts") ? title : `${title} — Mexico Charts`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow,noarchive" />}
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Mexico Charts" />
      <meta property="og:locale" content="es_MX" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
