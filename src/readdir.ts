/* src/index.ts
	Application entrypoint */

import fs from "fs";
import path from "path";

/** List of paths and buffers */
export interface FileBufferList {
	[path: string]: Buffer | null;
}

/** Recursively read all image files from a directory */
export function readFilesFromDir(dir: string, acceptedTypes: string[] = ["png", "jpg", "jpeg"]): FileBufferList {
	dir = path.resolve(dir);

	const bufList: FileBufferList = {};
	loadDirRecursive(dir, dir, acceptedTypes, bufList);

	return bufList;
}

/** Resolve and then relativeize two paths */
function pathRelative(root: string, resolved: string): string {
	return path.relative(path.resolve(root), path.resolve(resolved));
}

/** Load a directory recursively */
function loadDirRecursive(root: string, dir: string, acceptedTypes: string[], bufList: FileBufferList): void {
	const files: string[] = fs.readdirSync(dir, { encoding: "utf-8" });
	for (const file of files) {
		const fileResolved = path.resolve(dir, file);
		const fileRelative = pathRelative(root, fileResolved);
		const fileExt = path.extname(fileResolved).replace(/^\./, "");

		const fileInfo = fs.statSync(fileResolved);

		if (fileInfo.isFile()) {
			if (!acceptedTypes.includes(fileExt)) continue;
			try {
				const buf: Buffer = fs.readFileSync(fileResolved, { encoding: null });
				bufList[fileRelative] = buf;
			} catch (err) {
				// TODO: Handle
			}
		} else if (fileInfo.isDirectory()) {
			try {
				loadDirRecursive(root, fileResolved, acceptedTypes, bufList);
			} catch (err) {
				// TODO: Handle
			}
		} else continue;
	}
}
