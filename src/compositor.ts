/* src/compositor.ts
	Composites multiple image paths (tileset) into a tilemap image */

import sharp, { Sharp, OverlayOptions, FitEnum, KernelEnum } from "sharp";

import { logDebug, logInfo, logPath } from "./log";

/** Fit mode to use when resizing tiles, if a tile needs to be resized. */
export enum ResizeFit {
	/** Preserving aspect ratio, ensure the image covers both provided dimensions by cropping/clipping to fit. */
	Contain = "contain",
	/** Preserving aspect ratio, contain within both provided dimensions using "letterboxing" where necessary. */
	Cover = "cover",
	/** Ignore the aspect ratio of the input and stretch to both provided dimensions. */
	Fill = "fill",
	/** Preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified. */
	Inside = "inside",
	/** Preserving aspect ratio, resize the image to be as small as possible while ensuring its dimensions are greater than or equal to both those specified. */
	Outside = "outside"
}
/** Kernel to use when resizing tiles, if a tile needs to be resized. */
export enum ResizeKernel {
	/** Nearest neighbor algorithm. */
	Nearest = "nearest",
	/** Bicubic algorithm. */
	Bicubic = "cubic",
	/** Mitchell algorithm. */
	Mitchell = "mitchell",
	/** Lanczos resampling algorithm 2. */
	Lancoz2 = "lancoz2",
	/** Lanczos resampling algorithm 3. */
	Lancoz3 = "lancoz3"
}

/** File format to use for output data, PNG is recommended. */
export enum OutputType { PNG = "png", JPEG = "jpeg", WEBP = "webp", TIFF = "tiff" }

/** Output tilemap sizing information. */
export interface TilemapInfo {
	/** Width of this tilemap image, in pixels. */
	width: number;
	/** Height of this tilemap image, in pixels. */
	height: number;
	/** Count of tiles on the X axis. */
	countX: number;
	/** Count of tiles on the Y axis. */
	countY: number;
	/** Width of a tile in pixels. */
	tileWidth: number;
	/** Height of tile in pixels. */
	tileHeight: number;
}

/** Generate an overlay (OverlayOptions) from a file path. */
async function generateOverlay<T extends string | null, R extends (T extends string ? OverlayOptions : null)>(
	// Input file path (or null)
	filePath: T,
	// Width/height of each tile
	width: number, height: number,
	// Position of this tile
	x: number, y: number,
	// Resize options
	fit: ResizeFit, kernel: ResizeKernel
): Promise<R> {
	if (filePath === null) return null!;

	// Load and resize image
	const image: Sharp = sharp(filePath!).resize({
		width, height,
		fit: fit as keyof FitEnum,
		kernel: kernel as keyof KernelEnum,
		position: 8
	});
	// Generate output image data (as PNG for memory reasons)
	const data: Buffer = await image.png().toBuffer();

	// Create output overlay
	const overlay = {
		input: data,
		top: y * height, left: x * height,
		gravity: 8
	} as R

	logDebug(`composite: Generated overlay for "${logPath(filePath)}"`);
	return overlay;
}

/** Composite a 2D collection of image paths (tileset) into a tilemap. */
export async function composite(
	/** 2D array of file paths, ordered [y][x]. */
	inputFiles: (string | null)[][],
	/** Type of file data to generate. */
	outputType: OutputType = OutputType.PNG,
	/** Width of each tile. */
	width: number = 128,
	/** Height of each tile. */
	height: number = 128,
	/** Fit mode for resizing incorrectly sized tiles. */
	fit: ResizeFit = ResizeFit.Cover,
	/** Kernel mode for resizing incorrectly sized tiles. */
	kernel: ResizeKernel = ResizeKernel.Nearest,
	/** Minimum count of tiles on the X axis. */
	minCountX?: number,
	/** Minimum count of tiles on the Y axis. */
	minCountY?: number
): Promise<[Buffer, TilemapInfo]> {
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
	const imageWidth: number = width * countX;
	const imageHeight: number = height * countY;
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

	// Get data buffer
	const data: Buffer = await image.toBuffer();

	// Build tilemap info
	const info: TilemapInfo = {
		width: imageWidth,
		height: imageHeight,
		countX,
		countY,
		tileWidth: width,
		tileHeight: height
	};

	return [data, info];
}
