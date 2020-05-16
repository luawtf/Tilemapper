/* src/output.ts
	Convert the map to file data and write it to the disk */

import { promises as fs } from "fs";

import { Sharp } from "sharp";

import { verbose } from "./index";

/** Write the output map from compositeSequences to the disk */
export async function writeMap(file: string, useJPEG: boolean, map: Sharp): Promise<void> {
	let outputBuffer: Buffer;

	if (!useJPEG) {
		if (verbose) console.log("Flattening to PNG...");
		outputBuffer = await map.png().toBuffer();
	} else {
		if (verbose) console.log("Flattening to JPEG...");
		outputBuffer = await map
			.flatten({ background: { r: 255, g: 255, b: 255 } })
			.jpeg()
			.toBuffer();
	}

	if (verbose) console.log("Writing file '%s'...", file);

	await fs.writeFile(file, outputBuffer);
}
