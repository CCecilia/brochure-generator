import type { Link } from "..";
import { enrichLinkData, type SiteData } from "./scraper";

export interface PromptData {
  user: string,
  system: string,
}

export function evalutateLinksPrompt(siteURL: URL, siteData: SiteData): PromptData {
  const systemInstruction = `
You are provided with a list of links found on a webpage.
You are able to decide which of the links would be most relevant to include in a brochure about the company,
such as links to an About page, or a Company page, or Careers/Jobs pages.
You should respond in JSON as in this example:

{
  "relevantLinks": [
    {"linkType": "about page", "link": "https://full.url/goes/here/about"},
    {"linkType": "careers page", "link": "https://another.full.url/careers"}
  ]
}
  `;
  const userPrompt = `
Here is the list of links on the website ${siteURL.href} -
Please decide which of these are relevant web links for a brochure about the company,
respond with the full https URL in JSON format.
Do not include Terms of Service, Privacy, email links.

Links (some might be relative links): \n${siteData.links.map((url) => url.href).join("\n")}
  `;
  return {
    user: userPrompt,
    system: systemInstruction,
  };
}

export async function brochureCreationPrompt(
  companyName: string,
  siteData: SiteData,
  relevantLinks: Link[],
): Promise<PromptData> {
  const systemInstruction = `
You are an assistant that analyzes the contents of several relevant pages from a company website
and creates a short brochure about the company for prospective customers, investors and recruits.
Respond in markdown without code blocks.
Include details of company culture, customers and careers/jobs if you have the information.
`;
  let relevantLinkText = "## Relevant Links: \n";

  for (let index = 0; index < relevantLinks.length; index++) {
    const element = relevantLinks[index];
    if (element) {
      relevantLinkText += await enrichLinkData(element);
    }
  }
  const userPrompt = `
You are looking at a company called: ${companyName}
Here are the contents of its landing page and other relevant pages;
use this information to build a short brochure of the company in markdown without code blocks.\n\n
## Landing Page:\n${siteData.contents}\n\n
${relevantLinkText}
  `;

  return {
    system: systemInstruction,
    user: userPrompt
  }
}

export function linkContentSummaryPrompt(link: string): PromptData {
  const systemInstruction = `You are an assistant that analyzes the contents of a webpage and creates a short one paragraph summary. Respond in markdown without code blocks.`;
  const userPrompt = `Please provide a summary of this web page\n## Page: ${link}`
  return {
    system: systemInstruction,
    user: userPrompt,
  };
}