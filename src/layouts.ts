/* src/layouts.ts
	*/

import { PathInfo } from "./filewalker";
import { SmartSorter } from "./smartsorter";
import { logInfo, logWarn } from "./log";

/** Layout information for a tileset */
export interface Layout {
	/** Tileset data */
	tileset: (string | null)[][];
	/** Tile information */
	tiles: {
		/** Name of this tile */
		name: string;
		/** Path to this tile image */
		path: string;
		/** X position */
		x: number;
		/** Y position */
		y: number;
	}[];
}
/** Layout information with sequence locations */
export interface SequenceLayout extends Layout {
	/** Sequence information */
	sequences: {
		/** Sequence name */
		name: string;
		/** X position */
		row: number;
		/** Image count */
		length: number;
	}[];
}
/** Layout information with animation/angle locations */
export interface AnimationLayout extends Layout {
	/** Animation information */
	animations: {
		/** Animation name */
		name: string;
		/** Available angles for this animation */
		angles: {
			/** Angle degrees */
			angle: number;
			/** X position */
			row: number;
			/** Image count */
			length: number;
		}[];
	}[];
}

/** Options for layoutXXXX() */
export interface LayoutOptions {
	/** Use full paths in tile names */
	longTileNames?: boolean;
	/** Optional function for logging warnings */
	onWarning?: (message: string) => void;
}
/** Options for layoutList() */
export interface ListLayoutOptions extends LayoutOptions {
	/** Width of the tilemap */
	width?: number
};
/** Options for layoutSequences() */
export interface SequenceLayoutOptions extends LayoutOptions {
	/** Use full paths for sequence names */
	longSequenceNames?: boolean
};
/** Options for layoutAnimations() */
export interface AnimationLayoutOptions extends LayoutOptions {
	/** Use full paths for animation names */
	longAnimationNames?: boolean
};

/** Layout a tilemap in a simple con */
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
/** Layout a tilemap into collections of sequences */
export function layoutSequences(inputPathInfos: PathInfo[], options?: SequenceLayoutOptions): SequenceLayout {
	const longTileNames: boolean = options?.longTileNames ?? false;
	const longSequenceNames: boolean = options?.longSequenceNames ?? false;

	logInfo(`layoutSequences: Laying out ${inputPathInfos.length} images`);

	const tileset: Layout["tileset"] = [];
	const tiles: Layout["tiles"] = [];
	const sequences: SequenceLayout["sequences"] = [];

	const pathInfos: PathInfo[] = [...inputPathInfos];

	let y: number = 0; do {
		const pathInfo: PathInfo | null = pathInfos.shift() ?? null;
		if (!pathInfo) continue;

		const dirname = pathInfo.dirname;
		const sequence: SequenceLayout["sequences"][0] = {
			name: longSequenceNames
				? pathInfo.dirnames.join("/")
				: pathInfo.dirnames[pathInfo.dirnames.length - 1],
			row: y++,
			length: 0
		};

		let x: number = 0;
		const tilesetRow: (string | null)[] = tileset[y] = [];

		let curPathInfo: PathInfo | null = pathInfo;
		do {
			if (!curPathInfo) curPathInfo = pathInfos.shift() ?? null;
			if (!curPathInfo) break;

			tilesetRow[x++] = pathInfo.path;

			tiles.push({
				name:	(longTileNames ? pathInfo.dirnames.join("/") + "/" : "") +
					pathInfo.basename,
				path: pathInfo.path,
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
/** Layout a tilemap into collections of animations, with different sequences for each angle */
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

	for (let i = 0; i < inputPathInfos.length; i++) {
		const pathInfo = inputPathInfos[i];
		if (!pathInfo) continue;

		const dirnames = [...pathInfo.dirnames];
		const angleDirname: string | null = dirnames.shift() ?? null;
		const sequenceDirname: string | null = dirnames.length > 0 ? dirnames.join("/") : null;

		if (!angleDirname || !sequenceDirname) {
			options?.onWarning?.(`Path "${pathInfo.path}" ${
					!angleDirname		? "has an invalid angle string"
				:	!sequenceDirname	? "has an invalid sequence name"
				:	"is invalid"
			}`);
			continue;
		}

		let angle: number | null = Number(angleDirname); angle = angle === angle ? angle : null;
		let name: string | null = longAnimationNames ? sequenceDirname : (dirnames.shift() ?? null);

		if (angle === null || name === null) {
			options?.onWarning?.(`Path "${pathInfo.path}" ${
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
