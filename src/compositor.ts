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

/**
 * Create a Sharp image instance from the data in a file
 * @param path Path to file
 * @returns Sharp instance
 * @function
 */
const createSharpFromFile = (path: string): Sharp => sharp(path);
/**
 * Create a Sharp image instance from image data in a buffer
 * @param buffer Image data of any type (PNG, JPG, etc.)
 * @returns Sharp instance
 * @function
 */
const createSharpFromBuffer = (buffer: Buffer): Sharp => sharp(buffer);
/**
 * Create a Sharp image instance that is completely transparent with image dimensions
 * @param width New image width
 * @param heigh New image height
 * @returns Sharp instance
 * @function
 */
const createSharpFromDimensions = (width: number, height: number): Sharp =>
	sharp({ create: {
		width, height,
		channels: 4,
		background: "#FFFFFF00"
	} });

/** Load an image file at a file path and generate an overlay for it's tile with the correct size information */
async function generateOverlayFromImageFile(
	/** Input file path */
	filePath: string,
	/** Width/height of each tile */
	width: number, height: number,
	/** Position of this tile */
	x: number, y: number,
	/** Overscan to apply to this tile */
	overX: number, overY: number,
	/** Resize options */
	fit: ResizeFit, kernel: ResizeKernel
): Promise<OverlayOptions> {
	// Create a new Sharp instance with the given file path
	const image: Sharp = createSharpFromFile(filePath);

	// Apply the resize operation to fit the input image into a tile
	image.resize({
		width: width,
		height: height,

		fit: fit as keyof FitEnum,
		kernel: kernel as keyof KernelEnum,

		position: 8
	});

	// Apply overscan to the tile image
	if (overX === 0 && overY === 0) {
		// Do nothing
	} else if (overX > 0 && overY > 0) {
		image.extract({
			left: overX,
			top: overY,
			width: width - overX,
			height: height - overY
		});
	} else {
		image.extend({
			left: -overX, right: -overX,
			top: -overX, bottom: -overX,
			background: "#FFFFFF00"
		});
	}

	// Generate PNG image data from the tile image
	const data: Buffer = await image.png().toBuffer();

	// Generate the OverlayOptions instance with the PNG data
	const overlay: OverlayOptions = {
		input: data,

		left: x * (width - overX * 2),
		top: y * (height - overY * 2),

		gravity: 8
	};

	logDebug(`composite: Generated tile overlay for "${logPath(filePath)}"`);
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
	/** Overscan (x axis) to apply to each tile. */
	overX: number = 0,
	/** Overscan (y axis) to apply to each tile. */
	overY: number = 0,
	/** Fit mode for resizing incorrectly sized tiles. */
	fit: ResizeFit = ResizeFit.Cover,
	/** Kernel mode for resizing incorrectly sized tiles. */
	kernel: ResizeKernel = ResizeKernel.Nearest,
	/** Minimum count of tiles on the X axis. */
	minCountX?: number,
	/** Minimum count of tiles on the Y axis. */
	minCountY?: number,
	/** Number of tiles per chunk. */
	chunkTileCount: number = 128
): Promise<[Buffer, TilemapInfo]> {
	// Calculate tile counts
	let tileCountY: number = Math.floor(Math.max(0, minCountY ?? 0, inputFiles.length));
	let tileCountX: number = Math.floor(Math.max(0, minCountX ?? 0));
	for (let y = 0; y < inputFiles.length; y++) {
		if (inputFiles[y].length > tileCountX) {
			tileCountX = inputFiles[y].length;
		}
	}

	// Calculate actual tile dimensions
	const tileTotalWidth: number = width - overX * 2;
	const tileTotalHeight: number = height - overY * 2;

	// Calculate image dimensions
	const imageWidth: number = tileTotalWidth * tileCountX;
	const imageHeight: number = tileTotalHeight * tileCountY;

	// Create dimensions debug information string (contains all calculated values)
	const dimensionsString = `[${tileCountX}x${tileCountY} tiles at ${tileTotalWidth}x${tileTotalHeight} px per tile (${imageWidth}x${imageHeight} total px)]`;

	logInfo(`composite: Compositing tilemap... ${dimensionsString}`);


	// Generate tile overlays to composite into the tilemap image
	const tileOverlayGenerators: Promise<OverlayOptions>[] = [];
	for (let y = 0; y < tileCountY; y++) {
		const row: (string | null)[] | null = inputFiles[y] ?? null;
		if (row === null) continue;

		for (let x = 0; x < tileCountX; x++) {
			const filePath: string | null = row[x] ?? null;
			if (filePath === null) continue;

			tileOverlayGenerators.push(
				generateOverlayFromImageFile(
					filePath,
					width, height,
					x, y,
					overX, overY,
					fit, kernel
				)
			);
		}
	}
	// Await all those generated/generating tilemap overlays
	const tileOverlays: OverlayOptions[] = await Promise.all(tileOverlayGenerators);


	// Calculate the number of chunk overlays needed for all the tile overlays
	const chunkOverlayCount: number = Math.ceil(tileOverlays.length / chunkTileCount);
	logInfo(`composite: Combining ${tileOverlays.length} tile overlays into ${chunkOverlayCount} chunk overlays... ${dimensionsString}`);

	// List of running chunk overlay generation tasks
	const chunkOverlayGenerators: Promise<OverlayOptions>[] = [];

	// Generate chunk overlays and add each task to chunkOverlayGenerators
	let chunkOverlaysCompleted: number = 0;
	for (
		let i = 0, chunkOverlayNum = 1;
		i < tileOverlays.length;
		i += chunkTileCount, chunkOverlayNum++
	) {
		// Create array of tile overlays to use for this specific chunk
		const tileOverlaysChunkSlice: OverlayOptions[] = tileOverlays.slice(i, i + chunkTileCount);

		// Create a new image and composite in the slice of tile overlays
		const chunkImage: Sharp = createSharpFromDimensions(imageWidth, imageHeight);
		chunkImage.composite(tileOverlaysChunkSlice);

		// Create a "generator" thing that will return the PNG overlay once completed
		chunkOverlayGenerators.push(
			chunkImage
				.png()
				.toBuffer()
				.then((data: Buffer) => {
					logInfo(`composite: Completed chunk overlay #${chunkOverlayNum} (finished ${++chunkOverlaysCompleted} out of ${chunkOverlayCount})`);
					return { input: data } as OverlayOptions;
				})
		);
	}

	// Await all those generated/generating chunk overlays
	const chunkOverlays: OverlayOptions[] = await Promise.all(chunkOverlayGenerators);

	logInfo(`composite: Chunk overlay generation complete, compositing ${chunkOverlayCount} chunk overlays into final tilemap image... ${dimensionsString}`);


	// Create a new Sharp image with the tilemap image dimensions
	const image: Sharp = createSharpFromDimensions(imageWidth, imageHeight);

	// Composite the chunk overlays into the main tilemap image
	image.composite(chunkOverlays);

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

	logInfo(`composite: Final image compositing complete, exported image data (${outputType}), generating tilemap info...`);


	// Build tilemap info
	const info: TilemapInfo = {
		width: imageWidth,
		height: imageHeight,
		countX: tileCountX,
		countY: tileCountY,
		tileWidth: tileTotalWidth,
		tileHeight: tileTotalHeight
	};

	return [data, info];
}
