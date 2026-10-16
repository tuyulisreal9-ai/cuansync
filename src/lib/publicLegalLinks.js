// Set only after the public site's legal documents are finalized and published.
export function getPublicLegalLinks(siteUrl) {
  if (typeof siteUrl !== "string" || !siteUrl.trim()) return null;
  try {
    const url = new URL(siteUrl.trim());
    if (url.protocol !== "https:" || url.username || url.password ||
        url.search || url.hash || url.pathname !== "/") return null;
    return {
      privacy: new URL("privasi.html", url).href,
      terms: new URL("ketentuan.html", url).href,
    };
  } catch {
    return null;
  }
}
