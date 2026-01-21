import ollama from "ollama";
import { scrapeSiteData } from "./modules/scraper";
import { z } from "zod";
import { brochureCreationPrompt, evalutateLinksPrompt } from "./modules/prompts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export const MODEL = "deepseek-r1:14b"

export interface Link {
  linkType: string;
  link: string;
}

export interface RelevantLinks {
  relevantLinks: Link[];
}

const args = Bun.argv;
const inputCompanyName = args[2];
const inputSite = args[3];

console.log(args)

function failureExit(): void {
  console.error("Please provide a website address and company name");
  console.log("Usage: index.ts <company_name> <website_url>");
  process.exit(1);
}

function validateInput(): boolean {
  if (!inputCompanyName || !inputSite) {
    return false;
  }
  if (typeof inputCompanyName !== "string" || typeof inputSite !== "string") {
    return false;
  }

  if (!URL.canParse(inputSite)) {
    return false;
  }
  return true;
}

if (args.length < 4) {
  failureExit();
}

if (!validateInput()) {
  failureExit();
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
    model: MODEL,
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

  const brochurePrompt = await brochureCreationPrompt(
    companyName,
    siteData,
    structuredLinkRes.relevantLinks,
  );
  const brochureResponse = await ollama.chat({
    model: MODEL,
    messages: [
      { role: "system", content: brochurePrompt.system },
      { role: "user", content: brochurePrompt.user },
    ],
    options: {
      temperature: 0,
    },
  });

  return brochureResponse.message.content;
}

async function saveToBrochure(companyName: string, content: string): Promise<void> {
  try {
    const filePath = join(process.cwd(), `${companyName.replaceAll(' ', '-')}.md`);

    await writeFile(filePath, content, "utf8");

    console.log(`Successfully Created Brochure\nsaved to: ${filePath}`);
  } catch (error) {
    console.error("Error saving the file:", error);
    throw error;
  }
}

const brochureContents = await createBrochure(
  inputCompanyName!,
  new URL(inputSite!),
);

await saveToBrochure(inputCompanyName!, brochureContents);