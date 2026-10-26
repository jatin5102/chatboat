import { seedProperties } from "../../src/utils/seedProjects.utils.js";
import { prisma } from "../../src/config/prisma.config.js";

export { seedProperties };

if (process.argv[1]?.includes("seed-projects.ts")) {
  seedProperties()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
