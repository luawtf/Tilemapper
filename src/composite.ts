/* src/composite.ts
	Merge multiple sequences into a single tilemap */

import sharp, { Sharp, OverlayOptions } from "sharp";

import { Sequence, SequenceList, maximumSequenceImageCount, sequenceListLength } from "./sequence";

import { settings } from "./index";

/** Compile a list of sequences into a tile map */
export async function compositeSequences(sequences: SequenceList, tileWidth: number, tileHeight: number): Promise<Sharp> {
	const overlays: OverlayOptions[] = [];

	const tileCountX = maximumSequenceImageCount(sequences);
	const tileCountY = sequenceListLength(sequences);

	if (settings.verbose) console.log(`Creating overlays for a tilemap of ${tileCountX}x${tileCountY} size...`);

	for (let y = 0; y < tileCountY; y++) {
		const sequence: Sequence = sequences[y];

		const posY = y * tileHeight;

		let x: number; for (x = 0; x < tileCountX; x++) {
			const tileBuf: Buffer | null = sequence.images[x] ?? null;
			if (tileBuf === null) break;

			const posX = x * tileWidth;

			const tileSharp =
				sharp(tileBuf)
				.resize({
					width: tileWidth,
					height: tileHeight,
					position: 8,
					fit: "cover",
					kernel: "nearest"
				});

			overlays.push({
				input: await tileSharp.png().toBuffer(),
				top: posY,
				left: posX,
				// blend: "source",
				gravity: 8
			});
		}

		if (settings.verbose) console.log(`Added ${x + 1} overlays for row ${y + 1}`);
	};

	const map =
	sharp({
		create: {
			width: tileWidth * tileCountX,
			height: tileHeight * tileCountY,
			channels: 4,
			background: "rgba(0, 0, 0, 0)"
		}
	})
	.composite(overlays);

	return map;
}
