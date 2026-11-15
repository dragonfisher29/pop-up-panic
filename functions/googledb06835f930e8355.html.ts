// Google Search Console ownership file. Cloudflare Pages 308-redirects static
// *.html URLs to the extensionless path, and Google's file check can fail on a
// redirect, so serve the exact URL with a 200 here. Do not remove (Google
// re-checks it to keep the site verified). public/googledb06835f930e8355.html
// is the same content, kept for the extensionless path.
export const onRequest = (): Response =>
  new Response('google-site-verification: googledb06835f930e8355.html', {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
