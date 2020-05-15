/* src/index.ts
	Application entrypoint */

import { promises as fs } from "fs";
import sharp from "sharp";

import { readSequences } from "./sequence";
import { compositeSequences } from "./composite";

// Test code
(async () => {
	const sequences = await readSequences("test");
	const map = await compositeSequences(sequences, 120, 120);
	const buf = await map.png().toBuffer();
	await fs.writeFile("out.png", buf);
})();
