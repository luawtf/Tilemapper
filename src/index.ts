/* src/index.ts
	Application entrypoint */

import { readFilesFromDir } from "./readdir";
import { mapTiles } from "./mapgen";

import fs from "fs";
import sharp from "sharp";

// Test code
(async () => {
	const files = await readFilesFromDir("test");
	const tiles: Buffer[] = Object.values(files);

	const png = await mapTiles(tiles, 128, 128, 32, 32);
	await fs.promises.writeFile("out.png", png);
})();
