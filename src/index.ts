import ollama from "ollama";
import { scrapeSiteData } from "./modules/scraper";
import { z } from "zod";
import { brochureCreationPrompt, evalutateLinksPrompt } from "./modules/prompts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Link {
  linkType: string;
  link: string;
}

export interface RelevantLinks {
  relevantLinks: Link[];
}

async function createBrochure(companyName: string, siteURL: URL) {
  const siteData = await scrapeSiteData(siteURL)

  if (!siteData) {
    throw new Error("failed to scrape target site")
  }

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
  const linksPrompt = evalutateLinksPrompt(siteURL, siteData)
  const response = await ollama.chat({
    model: "deepseek-r1:7b",
    messages: [
      { role: "system", content: linksPrompt.system },
      { role: "user", content: linksPrompt.user },
    ],
    format: "json",
    options: {
      temperature: 0,
    },
  });

  if (typeof response.message.content !== "string") {
    throw new Error("Ollama failed to respond properly");
  }

  const structuredLinkRes = responseSchema.parse(
    JSON.parse(response.message.content),
  );

  const brochurePrompt = brochureCreationPrompt(
    companyName,
    siteData,
    structuredLinkRes.relevantLinks,
  );
  const brochureResponse = await ollama.chat({
    model: "deepseek-r1:7b",
    messages: [
      { role: "system", content: brochurePrompt.system },
      { role: "user", content: brochurePrompt.user },
    ],
    options: {
      temperature: 0,
    },
  });

  console.log(brochureResponse.message.content)

  return brochureResponse.message.content;
}

async function saveToBrochure(companyName: string, content: string): Promise<void> {
  try {
    const filePath = join(process.cwd(), `${companyName.replaceAll(' ', '-')}.md`);

    await writeFile(filePath, content, "utf8");

    console.log(`Successfully saved to ${filePath}`);
  } catch (error) {
    console.error("Error saving the file:", error);
    throw error;
  }
}

const brochureContents = await createBrochure(
  "hugging face",
  new URL("https://huggingface.co/"),
);

await saveToBrochure("hugging face", brochureContents)