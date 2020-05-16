/* src/composite.ts
	Merge multiple sequences into a single tilemap */

import sharp, { Sharp, OverlayOptions, FitEnum, KernelEnum } from "sharp";

import { Sequence, SequenceList, maximumSequenceImageCount, sequenceListLength } from "./sequence";

import { verbose } from "./index";

/** Tilemap generation options */
export interface CompositeOptions {
	tileWidth: number,
	tileHeight: number,

	minTileCountX: number,
	minTileCountY: number,

	tileFit: keyof FitEnum,
	tileKernel: keyof KernelEnum
}

/** Check if a value is a valit FitEnum */
export function isValidFit(fit: any): fit is keyof FitEnum {
	return ["contain", "cover", "fill", "inside", "outside"].includes(fit);
}
/** Check if a value is a valid KernelEnum */
export function isValidKernel(kernel: any): kernel is keyof KernelEnum {
	return ["nearest", "cubic", "mitchell", "lanczos2", "lanczos3"].includes(kernel);
}

/** Composite a list of sequences into a tilemap */
export async function compositeSequences(sequences: SequenceList, options: CompositeOptions): Promise<Sharp> {
	// Calculate required tilemap resolution (X, Y)
	const tileCountX = Math.max(maximumSequenceImageCount(sequences), options.minTileCountX);
	const tileCountY = Math.max(sequenceListLength(sequences), options.minTileCountY);

	// Require atleast 1 tile
	if (tileCountX < 1 || tileCountY < 1)
		throw new Error("Using current settings, tilemap would contain 0 tiles");

	if (verbose) console.log("Creating a tilemap with %s tiles (X) by %s sequences (Y)...", tileCountX, tileCountY);

	// computeOverlay async operations buffer
	const promises: Promise<void>[] = [];

	// Computed overlay options for use with .composite();
	const overlays: OverlayOptions[] = [];

	// Loop through all sequences
	for (let y = 0; y < tileCountY; y++) {
		// Get the sequence
		const sequence: Sequence | null = sequences[y] ?? null;
		if (sequence === null) break;

		// Calculate its Y pos
		const posY = y * options.tileHeight;

		// Loop through tiles within this sequence
		for (let x = 0; x < tileCountX; x++) {
			// Get the tile
			const tileBuf: Buffer | null = sequence.images[x] ?? null;
			if (tileBuf === null) break;

			// Calculate its X position
			const posX = x * options.tileWidth;

			// Push a computeOverlay option
			promises.push(computeOverlay(tileBuf, posX, posY, overlays, options));
		}
	}

	if (verbose) console.log("Computing overlay images for tilemap...");

	// Run all computeOverlay operations async
	await Promise.all(promises);

	// Generate the tilemap and composite operations
	const map =
		sharp({
			create: {
				width: options.tileWidth * tileCountX,
				height: options.tileHeight * tileCountY,
				channels: 4,
				background: "rgba(0, 0, 0, 0)"
			}
		})
		.composite(overlays);

	return map;
}

/** Resize a tile and create an OverlayOptions for it */
async function computeOverlay(tileBuf: Buffer, posX: number, posY: number, overlays: OverlayOptions[], options: CompositeOptions): Promise<void> {
	const tileSharp =
		sharp(tileBuf)
		.resize({
			width: options.tileWidth,
			height: options.tileHeight,
			position: 8,
			fit: options.tileFit,
			kernel: options.tileKernel
		});

	overlays.push({
		input: await tileSharp.png().toBuffer(),
		top: posY,
		left: posX,
		// blend: "source",
		gravity: 8
	});
}
