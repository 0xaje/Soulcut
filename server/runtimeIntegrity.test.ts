import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenRuntimeTerms = /\b(mock|fake|demo|simulat(?:ed|ion|e)?|synthetic)\b/i;

async function shippedSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return shippedSourceFiles(resolved);
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [resolved];
  }));
  return files.flat();
}

describe("production runtime integrity", () => {
  it("contains no mock, fake, demo, synthetic, or simulated behavior in shipped source", async () => {
    const files = (await Promise.all([
      shippedSourceFiles(path.join(projectRoot, "server")),
      shippedSourceFiles(path.join(projectRoot, "client", "src")),
    ])).flat();
    const offenders = (await Promise.all(files.map(async file => ({ file, source: await readFile(file, "utf8") })))).flatMap(({ file, source }) => {
      const match = source.match(forbiddenRuntimeTerms);
      return match ? [`${path.relative(projectRoot, file)}: ${match[0]}`] : [];
    });

    expect(offenders).toEqual([]);
  });
});
