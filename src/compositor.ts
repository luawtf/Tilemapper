/* src/compositor.ts
	Composites multiple image paths (tileset) into a tilemap image */

import sharp, { Sharp, OverlayOptions, FitEnum, KernelEnum } from "sharp";

import { logDebug, logInfo } from "./log";

/** Fit mode to use when resizing tiles, if a tile needs to be resized. */
export enum ResizeFit {
	Contain = "contain",
	Cover = "cover",
	Fill = "fill",
	Inside = "inside",
	Outside = "outside"
}
/** Kernel to use when resizing tiles, if a tile needs to be resized. */
export enum ResizeKernel {
	Nearest = "nearest",
	Bicubic = "cubic",
	Mitchell = "mitchell",
	Lancoz2 = "lancoz2",
	Lancoz3 = "lancoz3"
}

/** File format to use for output data, PNG is recommended. */
export enum OutputType { PNG = "png", JPEG = "jpeg", WEBP = "webp", TIFF = "tiff" }

/** Generate an overlay (OverlayOptions) from a file path */
async function generateOverlay<T extends string | null>(
	// Input file path (or null)
	filePath: T,
	// Width/height of each tile
	width: number, height: number,
	// Position of this tile
	x: number, y: number,
	// Resize options
	fit: ResizeFit, kernel: ResizeKernel
): Promise<T extends string ? OverlayOptions : null> {
	if (filePath === null) return null!;

	logDebug(`composite: Generating overlay for "${filePath}"`);

	// Load and resize image
	const image: Sharp = sharp(filePath!).resize({
		width, height,
		fit: fit as keyof FitEnum,
		kernel: kernel as keyof KernelEnum,
		position: 8
	});
	// Generate output image data (as PNG for memory reasons)
	const data: Buffer = await image.png().toBuffer();

	// Return output overlay
	return {
		input: data,
		top: y * height, left: x * height,
		gravity: 8
	} as OverlayOptions as any;
}

/** Composite a 2D collection of image paths (tileset) into a tilemap */
export async function composite(
	/** 2D array of file paths, ordered [y][x] */
	inputFiles: (string | null)[][],
	/** Type of file data to generate */
	outputType: OutputType = OutputType.PNG,
	/** Width of each tile */
	width: number = 128,
	/** Height of each tile */
	height: number = 128,
	/** Fit mode for resizing incorrectly sized tiles */
	fit: ResizeFit = ResizeFit.Cover,
	/** Kernel mode for resizing incorrectly sized tiles */
	kernel: ResizeKernel = ResizeKernel.Nearest,
	/** Minimum count of tiles on the X axis */
	minCountX?: number,
	/** Minimum count of tiles on the Y axis */
	minCountY?: number
): Promise<Buffer> {
	// Calculate tile counts
	let countY: number = Math.floor(Math.max(0, minCountY ?? 0, inputFiles.length));
	let countX: number = Math.floor(Math.max(0, minCountX ?? 0));
	for (let y = 0; y < inputFiles.length; y++) {
		if (inputFiles[y].length > countX) {
			countX = inputFiles[y].length;
		}
	}

	logInfo(`composite: Compositing tilemap with ${countX}x${countY} tiles (${countX * width}x${countY * height})`);

	// Computed overlays
	const overlays: OverlayOptions[] = [];

	// Generate overlays
	const promises: Promise<void>[] = [];
	for (let y = 0; y < countY; y++) {
		const row: (string | null)[] | null = inputFiles[y] ?? null;
		if (row === null) continue;

		for (let x = 0; x < countX; x++) {
			const filePath: string | null = row[x] ?? null;
			if (filePath === null) continue;

			promises.push(
				generateOverlay(filePath, width, height, x, y, fit, kernel)
					.then((overlay) => void (overlay ? overlays.push(overlay) : null))
			);
		}
	}
	await Promise.all(promises);

	logInfo(`composite: Generated ${overlays.length} overlays, compositing...`);

	// Create image
	const imageHeight: number = height * countY;
	const imageWidth: number = width * countX;
	const image: Sharp = sharp({ create: {
		width: imageWidth,
		height: imageHeight,
		channels: 4,
		background: "#FFFFFF00"
	} });

	// Composite overlays into image
	image.composite(overlays);

	// Set output mode
	switch (outputType) {
		case OutputType.PNG:	image.png();	break;
		case OutputType.JPEG:	image.jpeg();	break;
		case OutputType.WEBP:	image.webp();	break;
		case OutputType.TIFF:	image.tiff();	break;
		default: throw new Error(`Invalid OutputType "${outputType}"`);
	}

	// Return data buffer!
	return image.toBuffer();
}
