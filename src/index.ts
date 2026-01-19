import ollama from "ollama";
import { scrapeLinks } from "./modules/scraper";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

async function createBrochure(siteURL: URL) {
  const scrapedLinks = await scrapeLinks(siteURL);
  const hrefs = scrapedLinks.map((url) => url.href);
  const responseSchema = z
    .object({
      relevantLinks: z
        .array(
          z.object({
            linkType: z.string().describe("Type of link"),
            link: z.string().describe("The link"),
          }),
        )
        .describe("Array of link objects {linkType: string, link: string}"),
    })
    .describe("Expected response schema");
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

Links (some might be relative links): \n${hrefs.join("\n")}
  `;

  const response = await ollama.chat({
    model: "deepseek-r1:7b",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt },
    ],
    options: {
      temperature: 0,
    },
  });

  if (typeof response.message.content !== "string") {
    throw new Error("Gemini failed to respond");
  }

  const structuredRes = responseSchema.parse(
    JSON.parse(response.message.content),
  );
  console.log(structuredRes.relevantLinks);

  return structuredRes.relevantLinks;
}

await createBrochure(new URL("https://edwarddonner.com/"));

