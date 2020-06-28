/* src/layouts.ts
	Functions for generating tilesets (for the compositor) from a collection of input image paths */

import { PathInfo } from "./filewalker";
import { SmartSorter } from "./smartsorter";

/** Base layout, only tileset information */
export interface Layout {
	tileset: (string | null)[][];
}
/** Generate a simple tileset that is just a continuos list of tiles, with a specific width */
export function layoutList(inputPathInfos: PathInfo[], width: number = 64): Layout {
	// Unpack paths
	const inputPaths: string[] = inputPathInfos.map((pathInfo) => pathInfo.path);

	// Output 2D array
	const output: (string | null)[][] = [];

	// Loop through rows
	let y = 0; do {
		const row: (string | null)[] = [];

		// Loop through columns
		for (let x = 0; x < width; x++) {
			const filePath: string | null = inputPaths.shift() ?? null;
			row[x] = filePath;
		}

		output[y++] = row;
	} while (inputPaths.length > 0);

	return { tileset: output };
}

/** Sequence layout, contains sequence information */
export interface SequenceLayout extends Layout {
	/** List of sequences */
	sequences: {
		/** Name of this sequence */
		name: string;
		/** Sequence row number (zero-indexed) */
		row: number;
		/** Length of this sequence */
		length: number;
	}[];
}
/** Generate a tileset of sequences */
export function layoutAnimatedSequences(inputPathInfos: PathInfo[], topLevelNames: boolean = true): SequenceLayout {
	// Path information for each sequence entry
	const sequencePaths: {
		[dirname: string]: {
			firstPathInfo: PathInfo;
			paths: string[];
		}
	} = {};

	// Populate sequencePaths
	for (let i = 0; i < inputPathInfos.length; i++) {
		const pathInfo = inputPathInfos[i];
		if (!pathInfo) continue;

		const dirname = pathInfo.dirname;
		const path = pathInfo.path;
		if (sequencePaths[dirname]) {
			sequencePaths[dirname].paths.push(path);
		} else {
			sequencePaths[dirname] = {
				firstPathInfo: pathInfo,
				paths: [path]
			};
		}
	}

	const tileset: (string | null)[][] = [];
	const sequences: SequenceLayout["sequences"] = [];

	// Generate tileset and sequence listing
	const keys: string[] = new SmartSorter().sortInPlace(Object.keys(sequencePaths));
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		const sequencePathList = sequencePaths[key];

		const name: string = topLevelNames
			? sequencePathList.firstPathInfo.dirnames[sequencePathList.firstPathInfo.dirnames.length - 1]
			: sequencePathList.firstPathInfo.dirnames.join("/");
		const row: string[] = sequencePathList.paths;
		const length: number = row.length;

		tileset[i] = row;
		sequences[i] = { name, row: i, length };
	}

	return { tileset, sequences };
}

/** Animation layout, contains a list of animations with sequences for each possible angle */
export interface AnimatedLayout extends Layout {
	/** List of animations */
	animations: {
		/** Name of this animation */
		name: string;
		/** Dictionary of angles to sequence information */
		angles: { [deg: number]: {
			row: number;
			length: number;
		} }
	}[];
}
export function layoutAnimatedAnimations(inputPathInfos: PathInfo[]): AnimatedLayout {
	// TODO
	throw new Error("Unimplemented");
}
