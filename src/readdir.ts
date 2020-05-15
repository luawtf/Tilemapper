/* src/index.ts
	Application entrypoint */

import fs from "fs";
import path from "path";

/** List of paths and buffers */
export interface FileBufferList {
	[path: string]: Buffer;
}

/** Recursively read all image files from a directory */
export async function readFilesFromDir(dir: string, acceptedTypes: string[] = ["png", "jpg", "jpeg"]): Promise<FileBufferList> {
	dir = path.resolve(dir);

	const bufList: FileBufferList = {};
	await loadDirRecursive(dir, dir, acceptedTypes, bufList);

	return bufList;
}

/** Resolve and then relativeize two paths */
function pathRelative(root: string, resolved: string): string {
	return path.relative(path.resolve(root), path.resolve(resolved));
}

/** Load a directory recursively */
async function loadDirRecursive(root: string, dir: string, acceptedTypes: string[], bufList: FileBufferList): Promise<void> {
	const files: string[] = await fs.promises.readdir(dir, { encoding: "utf-8" });

	const promises: Promise<void>[] = [];

	for (const file of files) {
		const fileResolved = path.resolve(dir, file);
		const fileRelative = pathRelative(root, fileResolved);
		const fileExt = path.extname(fileResolved).replace(/^\./, "");

		promises.push(loadFileRecursive(root, acceptedTypes, bufList, fileResolved, fileRelative, fileExt));
	}

	await Promise.all(promises);
}

async function loadFileRecursive(root: string, acceptedTypes: string[], bufList: FileBufferList, fileResolved: string, fileRelative: string, fileExt: string): Promise<void> {
	const fileInfo = await fs.promises.stat(fileResolved);

	if (fileInfo.isFile()) {
		if (!acceptedTypes.includes(fileExt)) return;
		try {
			const buf: Buffer = await fs.promises.readFile(fileResolved, { encoding: null });
			bufList[fileRelative] = buf;
		} catch (err) {
			// TODO: Handle
		}
	} else if (fileInfo.isDirectory()) {
		try {
			await loadDirRecursive(root, fileResolved, acceptedTypes, bufList);
		} catch (err) {
			// TODO: Handle
		}
	}
}
