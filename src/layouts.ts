/* src/layouts.ts
	Functions for generating tilesets (for the compositor) from a collection of input image paths */

import { PathInfo } from "./filewalker";

/** Layout a collection of image paths without any order, in a tileset of a specific width */
export function layoutList(inputPathInfos: PathInfo[], width: number = 64): (string | null)[][] {
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

	return output;
}

/** Layout a collection of image paths based on what folders they occupy */
export function layoutSequences(inputPathInfos: PathInfo[]): (string | null)[][] {
	// TODO
	throw new Error("Unimplemented");
}

export function layoutAnimations(inputPathInfos: PathInfo[]): (string | null)[][] {
	// TODO
	throw new Error("Unimplemented");
}
