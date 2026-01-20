import * as cheerio from "cheerio";

export interface SiteData {
  links: URL[],
  contents: string
}

export async function scrapeSiteData(targetUrl: URL): Promise<SiteData | null> {
  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Title
    const title = $("title").text().trim() || "No title found";

    // Target the body element
    const body = $("body");

    if (body.length > 0) {
      // Remove irrelevant tags
      body.find("script, style, img, input, noscript, iframe").remove();

      // Extract text and normalize whitespace (similar to BeautifulSoup's strip=True)
      const text = body.text().replace(/\s\s+/g, "\n").trim();

      const combined = `${title}\n\n${text}`;
      combined.substring(0, 2000);
    }

    const contents = title.substring(0, 2000);

    // We store the 'href' string in the Set to ensure uniqueness,
    // as two different URL objects are never "equal" in JS.
    const uniqueHrefs = new Set<string>();

    $("a").each((_, element) => {
      const href = $(element).attr("href");

      if (href) {
        try {
          // Resolve relative links to absolute strings
          const absoluteUrl = new URL(href, targetUrl).href;
          uniqueHrefs.add(absoluteUrl);
        } catch (e) {
          // Skip invalid URLs (like 'javascript:void(0)' or mailto: links)
        }
      }
    });

    const links = Array.from(uniqueHrefs).map((link) => new URL(link));

    return {
      links,
      contents,
    };
  } catch (error) {
    console.error(`Scraping failed: ${error}`);
    return null;
  }
}
