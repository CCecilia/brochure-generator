import * as cheerio from "cheerio";

/**
 * Scrapes a URL and returns an array of all unique absolute links found on the page.
 * @param url - The website URL to scrape
 * @returns Promise<string[]> - A list of unique URLs
 */
export async function scrapeLinks(targetUrl: URL): Promise<URL[]> {
  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // We store the 'href' string in the Set to ensure uniqueness,
    // as two different URL objects are never "equal" in JS.
    const uniqueHrefs = new Set<string>();

    $('a').each((_, element) => {
      const href = $(element).attr('href');

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

    // Map the unique strings back into URL objects
    return Array.from(uniqueHrefs).map(link => new URL(link));
  } catch (error) {
    console.error(`Scraping failed: ${error}`);
    return [];
  }
}
