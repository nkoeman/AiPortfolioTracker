type PdfTextResult = {
  text: string;
};

type PdfParserInstance = {
  getText: () => Promise<PdfTextResult>;
  destroy: () => Promise<void>;
};

type PdfParserConstructor = new (options: { data: Buffer }) => PdfParserInstance;

type PdfParseModule = {
  PDFParse: PdfParserConstructor;
};

async function loadPdfParseModule(): Promise<PdfParseModule> {
  const globalRecord = globalThis as {
    __non_webpack_require__?: (id: string) => unknown;
  };
  if (typeof globalRecord.__non_webpack_require__ === "function") {
    return globalRecord.__non_webpack_require__("pdf-parse") as PdfParseModule;
  }

  try {
    const runtimeRequire = (0, eval)("require") as ((id: string) => unknown) | undefined;
    if (typeof runtimeRequire === "function") {
      return runtimeRequire("pdf-parse") as PdfParseModule;
    }
  } catch {
    // ignore: ESM runtime without require
  }

  const dynamicModule = (await import("pdf-parse")) as unknown as PdfParseModule;
  return dynamicModule;
}

export async function extractPdfText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await loadPdfParseModule();
  const parser = new PDFParse({ data: bytes });
  try {
    const parsed = await parser.getText();
    return parsed.text || "";
  } finally {
    await parser.destroy();
  }
}
