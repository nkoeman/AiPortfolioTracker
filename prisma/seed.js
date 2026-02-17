const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

function loadDegiroVenueSeeds() {
  const filePath = path.join(__dirname, "degiroVenueMap.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw);

  if (!Array.isArray(payload)) {
    throw new Error("prisma/degiroVenueMap.json must contain an array.");
  }

  return payload.map((row) => {
    const brokerVenueCode = String(row.Beurs || row.beurs || "").trim().toUpperCase();
    const mic = String(row.mic || row.MIC || "").trim().toUpperCase();
    const descriptionRaw = row.exchange || row.Exchange || null;
    const description = descriptionRaw ? String(descriptionRaw).trim() : null;

    if (!brokerVenueCode || !mic) {
      throw new Error(`Invalid venue row: ${JSON.stringify(row)}`);
    }

    return { brokerVenueCode, mic, description };
  });
}

async function main() {
  const DEGiroVenueSeeds = loadDegiroVenueSeeds();

  for (const seed of DEGiroVenueSeeds) {
    await prisma.degiroVenueMap.upsert({
      where: { brokerVenueCode: seed.brokerVenueCode },
      update: { mic: seed.mic, description: seed.description },
      create: seed
    });
  }

  console.log(`[SEED] upserted ${DEGiroVenueSeeds.length} DeGiro venue mappings`);
}

main()
  .catch((error) => {
    console.error("[SEED] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
