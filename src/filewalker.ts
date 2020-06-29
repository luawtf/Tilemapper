/* src/filewalker.ts
	Provides a function for quickly searching the filesystem for matching images */

import { promises as fs } from "fs";
import path from "path";

import { SmartSorter } from "./smartsorter";
import { logDebug, logInfo } from "./log";

/** Object containing a path and its parts. */
export interface PathInfo {
	/** Absolute path. */
	path: string;
	/** Absolute dirname. */
	dirname: string;

	/** List of directories relative to the working directory. */
	dirnames: string[];
	/** File name without last extension. */
	basename: string;
	/** Extension string without period. */
	extname: string; extnameLower: string;
}
/** Generate path info from a working directory and a file path. */
export function toPathInfo(workingDirectory: string, filePath: string): PathInfo {
	const absolute = path.resolve(filePath);
	const relative = path.relative(workingDirectory, absolute);

	const dirnameAbsolute = path.dirname(absolute);

	const dirnameFull = path.dirname(relative);
	const extnameFull = path.extname(relative);

	const dirnames = dirnameFull.split(path.sep);
	const basename = path.basename(relative, extnameFull);
	const extname = extnameFull.replace(/^\./, "");

	const extnameLower = extname.toLowerCase();

	return {
		path: absolute,
		dirname: dirnameAbsolute,
		dirnames, basename,
		extname, extnameLower
	};
}

/** Check if a file's extension matches an extension list. */
function extensionsInclude(extensions: string[] | null, filePath: string): boolean {
	// Return true if extensions was not provided
	if (!extensions) return true;
	// Get the simplified extension name
	const extnameLower = path.extname(filePath).replace(/^\./, "").toLowerCase();
	// Check to see if extensions includes this name
	for (let i = 0; i < extensions.length; i++) {
		if (extensions[i] === extnameLower) return true;
	}
	// Return false if it doesn't
	logDebug(`walk: Skipping file "${filePath}", extensions don't match`);
	return false;
}
/** Recursively walk through a directory (or file) and return all matching file paths. */
async function walkPath(
	/** Working directory. */
	workingDirectory: string,
	/** File path to start in/at. */
	filePath: string,
	/** Extensions to match. */
	extensions: string[] | null,
	/** Top level? */
	top: boolean
): Promise<string[]> {
	const stats = await fs.stat(filePath);

	if (stats.isDirectory()) {
		logDebug(`walk: Walking directory "${filePath}"`);

		// Generate a list of absolute file paths to walk to
		const filePaths =
			(await fs.readdir(filePath, { encoding: "utf-8" }))
				.map((subFilePath) => path.resolve(filePath, subFilePath));

		// List of resulting paths
		const walkedFilePaths: string[] = [];

		const promises: Promise<void>[] = [];
		for (let i = 0; i < filePaths.length; i++) {
			const filePath = filePaths[i];
			// Walk this sub-path
			promises.push(
				walkPath(workingDirectory, filePath, extensions, false)
					.then((subFilePaths) => void walkedFilePaths.push(...subFilePaths))
			);
		}

		// Wait until all walking is finished
		await Promise.all(promises);

		return walkedFilePaths;
	} else if (stats.isFile()) {
		// Make sure this file matches
		if (!top && !extensionsInclude(extensions, filePath)) return [];
		// Cool! Return just this file since its not a directory
		logDebug(`walk: Adding file "${filePath}"`);
		return [filePath];
	}

	return [];
}

/** Search one or more paths (recursively) for files (with the correct extensions). */
export async function walkPaths(
	/** Path(s) to search. */
	paths: string | string[],
	/** Extensions to match. */
	extensions: string[] | null = ["png", "jpg", "jpeg", "gif", "webp", "tiff", "svg"],
	/** Working directory. */
	workingDirectory: string = process.cwd()
): Promise<PathInfo[]> {
	if (typeof paths === "string") paths = [paths];

	if (extensions) {
		extensions = extensions.map((ext) => ext.toLowerCase());
	} else {
		extensions = null;
	}

	logInfo(`walk: Running on paths "${paths.join(",")}"`);

	// Resulting file paths (will be converted to a PathInfo[])
	const filePaths: string[] = [];

	// Walk through all inputted paths
	const promises: Promise<void>[] = [];
	for (let i = 0; i < paths.length; i++) {
		const filePath = path.resolve(workingDirectory, paths[i]);
		promises[i] =
			walkPath(workingDirectory, filePath, extensions, true)
				.then((subFilePaths) => void filePaths.push(...subFilePaths));
	}

	// Wait for all walking to complete
	await Promise.all(promises);
	logInfo("walk: Completed");

	// Sort file paths
	new SmartSorter().sortInPlace(filePaths);

	// Return PathInfos
	return filePaths.map((filePath) => toPathInfo(workingDirectory, filePath));
}
