/* src/layouts.ts
	Functions for laying out input images into tilesets in different ways*/

import { PathInfo } from "./filewalker";
import { SmartSorter } from "./smartsorter";
import { logInfo, logWarn } from "./log";

/** Base layout information, contains information on a layout and its contents. */
export interface Layout {
	/** Tileset, a 2D array ([y][x]) of file paths (or nulls) to composite into a tilemap. */
	tileset: (string | null)[][];
	/** Information about each non-null tile in this layout. */
	tiles: {
		/** Name of this tile. */
		name: string;
		/** Path to this tile's image. */
		path: string;
		/** X position (coords, not pixels). */
		x: number;
		/** Y position (coords, not pixels). */
		y: number;
	}[];
}
/** Layout information, contains information on a layout and its contents, with added sequence listing. */
export interface SequenceLayout extends Layout {
	/** List of sequences in this layout. */
	sequences: {
		/** Sequence name. */
		name: string;
		/** X position (coords, not pixels). */
		row: number;
		/** Count of images on this row (and in this sequence). */
		length: number;
	}[];
}
/** Layout information, contains information on a layout and its contents, with added animation listing. */
export interface AnimationLayout extends Layout {
	/** List of animations in this layout. */
	animations: {
		/** Animation name. */
		name: string;
		/** List of angles (sequences, really) in this animation. */
		angles: {
			/** Angle degrees. */
			angle: number;
			/** X position (coords, not pixels). */
			row: number;
			/** Count of images on this row (and in this sequence). */
			length: number;
		}[];
	}[];
}

/** Options for all layout functions. */
export interface LayoutOptions {
	/** Use full directory names in tile names (layout.tiles). */
	longTileNames?: boolean;
}
/** Options for the layoutList() function. */
export interface ListLayoutOptions extends LayoutOptions {
	/** Width (in tiles) of the tilemap to generate. */
	width?: number;
}
/** Options for the layoutSequences() function. */
export interface SequenceLayoutOptions extends LayoutOptions {
	/** Use full directory names in sequence names (layout.sequences[i]). */
	longSequenceNames?: boolean;
}
/** Options for the layoutAnimations() function. */
export interface AnimationLayoutOptions extends LayoutOptions {
	/** Use full directory names in animation names (layout.animations[i]). */
	longAnimationNames?: boolean;
}

/** Generate a tilemap layout in the simplest manner possible, just put all input tiles in a continuous list going from left to right, looping back to the next line once "width" is reached. */
export function layoutList(inputPathInfos: PathInfo[], options?: ListLayoutOptions): Layout {
	// Unpack options
	const longTileNames: boolean = options?.longTileNames ?? false;
	const width: number = options?.width ?? 64;

	logInfo(`layoutList: Laying out ${inputPathInfos.length} images with width ${width}`);

	// Create output layout contents
	const tileset: Layout["tileset"] = [];
	const tiles: Layout["tiles"] = [];

	// Duplicate input
	const pathInfos: PathInfo[] = [...inputPathInfos];

	// Loop through rows
	let y = 0; do {
		const row: Layout["tileset"][0] = [];

		// Loop through col
		for (let x = 0; x < width; x++) {
			const pathInfo: PathInfo | null = pathInfos.shift() ?? null;
			row[x] = pathInfo?.path ?? null;

			if (pathInfo !== null) {
				tiles.push({
					name:	(longTileNames ? pathInfo.dirnames.join("/") + "/" : "") +
						pathInfo.basename,
					path: pathInfo.path,
					x, y
				});
			}
		}

		tileset[y++] = row;
	} while (pathInfos.length > 0);

	return { tileset, tiles };
}

/** Generate a tilemap layout that contains "sequences". Each "sequence" is a continuos list of frames, usually for an animation. Each folder in the inputted paths will be treated as a new sequence. */
export function layoutSequences(inputPathInfos: PathInfo[], options?: SequenceLayoutOptions): SequenceLayout {
	const longTileNames: boolean = options?.longTileNames ?? false;
	const longSequenceNames: boolean = options?.longSequenceNames ?? false;

	logInfo(`layoutSequences: Laying out ${inputPathInfos.length} images`);

	const tileset: Layout["tileset"] = [];
	const tiles: Layout["tiles"] = [];
	const sequences: SequenceLayout["sequences"] = [];

	const pathInfos: PathInfo[] = [...inputPathInfos];

	let y = 0; do {
		const pathInfo: PathInfo | null = pathInfos.shift() ?? null;
		if (!pathInfo) continue;

		const dirname = pathInfo.dirname;
		const sequence: SequenceLayout["sequences"][0] = {
			name: longSequenceNames
				? pathInfo.dirnames.join("/")
				: pathInfo.dirnames[pathInfo.dirnames.length - 1],
			row: y,
			length: 0
		};

		let x: number = 0;
		const tilesetRow: (string | null)[] = tileset[y++] = [];

		let curPathInfo: PathInfo | null = pathInfo;
		do {
			if (!curPathInfo) curPathInfo = pathInfos.shift() ?? null;
			if (!curPathInfo) break;

			tilesetRow[x++] = curPathInfo.path;

			tiles.push({
				name:	(longTileNames ? curPathInfo.dirnames.join("/") + "/" : "") +
					curPathInfo.basename,
				path: curPathInfo.path,
				x, y
			});

			sequence.length++;

			curPathInfo = null;
		} while (pathInfos[0]?.dirname === dirname);

		sequences.push(sequence);
	} while (pathInfos.length > 0);

	logInfo(`layoutSequences: Generated ${sequences.length} sequences`);

	return { tileset, tiles, sequences };
}

/**
 * Generate a tilemap layout that contains "animations", where each animation has sub-sequences for different angles.
 * This will take a file structure like:
 * ```
 * root/
 *   anim1/
 *     0/   [frame1.png, frame2.png, frame3.png]
 *     90/  [frame1.png, frame2.png, frame3.png]
 *     180/ [frame1.png, frame2.png, frame3.png]
 *     270/ [frame1.png, frame2.png, frame3.png]
 *   anim2/
 *     0/   [frame1.png, frame2.png, frame3.png]
 *     90/  [frame1.png, frame2.png, frame3.png]
 *     180/ [frame1.png, frame2.png, frame3.png]
 *     270/ [frame1.png, frame2.png, frame3.png]
 * ```
 * And output something like:
 * ```json
 * {
 *   "animations": [
 *     {
 *       "name": "anim1",
 *       "angles": [
 *         { ... },
 *         { ... },
 *         { ... },
 *         { ... }
 *       ]
 *     },
 *     {
 *       "name": "anim2",
 *       "angles": [
 *         { ... },
 *         { ... },
 *         { ... },
 *         { ... }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export function layoutAnimations(inputPathInfos: PathInfo[], options?: AnimationLayoutOptions): AnimationLayout {
	const longTileNames: boolean = options?.longTileNames ?? false;
	const longAnimationNames: boolean = options?.longAnimationNames ?? false;

	logInfo(`layoutAnimations: Laying out ${inputPathInfos.length} images`);

	const tileset: Layout["tileset"] = [];
	const tiles: Layout["tiles"] = [];
	const animations: AnimationLayout["animations"] = [];

	const animationPaths: {
		[sequenceDirname: string]: {
			name: string;
			angles: {
				[angleDirname: string]: {
					angle: number;
					paths: PathInfo[];
				}
			}
		}
	} = {};

	// Populate animationPaths
	for (let i = 0; i < inputPathInfos.length; i++) {
		const pathInfo = inputPathInfos[i];
		if (!pathInfo) continue;

		const dirnames = [...pathInfo.dirnames];
		const angleDirname: string | null = dirnames.shift() ?? null;
		const sequenceDirname: string | null = dirnames.length > 0 ? dirnames.join("/") : null;

		if (!angleDirname || !sequenceDirname) {
			logWarn(`Path "${pathInfo.path}" ${
					!angleDirname		? "has an invalid angle string"
				:	!sequenceDirname	? "has an invalid sequence name"
				:	"is invalid"
			}`);
			continue;
		}

		let angle: number | null = Number(angleDirname); angle = angle === angle ? angle : null;
		let name: string | null = longAnimationNames ? sequenceDirname : (dirnames.shift() ?? null);

		if (angle === null || name === null) {
			logWarn(`Path "${pathInfo.path}" ${
					angle === null		? "has an invalid angle"
				:	name === null		? "has an invalid name"
				:	"failed to parse"
			}`);
			continue;
		}

		if (!animationPaths[sequenceDirname]) {
			animationPaths[sequenceDirname] = {
				name,
				angles: {}
			};
		}
		const animationPath = animationPaths[sequenceDirname];

		if (!animationPath.angles[angle])
			animationPath.angles[angle] = { angle, paths: [pathInfo] };
		else
			animationPath.angles[angle].paths.push(pathInfo);
	}

	// Interpret animationPaths
	const dirnames: string[] = new SmartSorter().sortInPlace(Object.keys(animationPaths));
	for (let i = 0; i < dirnames.length; i++) {
		const dirname = dirnames[i];
		const animationPath = animationPaths[dirname];

		const animation: AnimationLayout["animations"][0] = {
			name: animationPath.name,
			angles: []
		};
		const angles = animation.angles;

		const angleKeys: number[] = Object.keys(animationPath.angles).map(Number).sort();
		for (let ii = 0; ii < angleKeys.length; ii++) {
			const angleKey: number = angleKeys[ii];
			const anglePaths = animationPath.angles[angleKey];

			const rowIndex = tileset.push([]) - 1;
			const row = tileset[rowIndex];

			const length = anglePaths.paths.length;

			for (let x = 0; x < anglePaths.paths.length; x++) {
				const pathInfo = anglePaths.paths[x];

				row[x] = pathInfo.path;

				tiles.push({
					name:	(longTileNames ? pathInfo.dirnames.join("/") + "/" : "") +
						pathInfo.basename,
					path: pathInfo.path,
					x, y: rowIndex
				});
			}

			angles.push({ angle: angleKey, row: rowIndex, length });
		}

		animations.push(animation);
	}

	logInfo(`layoutAnimations: Generated ${animations.length} animations`);

	return { tileset, tiles, animations };
}
