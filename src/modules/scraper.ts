import ollama from "ollama";
import * as cheerio from "cheerio";
import { MODEL, type Link } from "..";
import { linkContentSummaryPrompt } from "./prompts";

export interface SiteData {
  links: URL[];
  contents: string;
}

export async function scrapeSiteData(targetUrl: URL): Promise<SiteData | null> {
  let combined = "";

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Title
    const title = $("title").text().trim() || "No title found";
    title.substring(0, 2000);

    // Target the body element
    const body = $("body");

    if (body.length > 0) {
      // Remove irrelevant tags
      body.find("script, style, img, input, noscript, iframe").remove();

      // Extract text and normalize whitespace (similar to BeautifulSoup's strip=True)
      const text = body.text().replace(/\s\s+/g, "\n").trim();

      combined = `${title}\n\n${text}`;
      combined.substring(0, 2000);
    }

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
      contents: combined,
    };
  } catch (error) {
    console.error(`Scraping failed: ${error}`);
    return null;
  }
}

export async function enrichLinkData(link: Link): Promise<string> {
  try {
    const linkSummaryPrompt = linkContentSummaryPrompt(link.link);

    const contentSummary = await ollama.chat({
      model: MODEL,
      messages: [
        { role: "system", content: linkSummaryPrompt.system },
        { role: "user", content: linkSummaryPrompt.user },
      ],
      options: {
        temperature: 0,
      },
    });

    return `\n## Link: ${link.link}\n## Type: ${link.linkType}\n## Contents: ${contentSummary}`;
  } catch (error) {
    console.error(`Scraping failed: ${error}`);
    return "";
  }
}
