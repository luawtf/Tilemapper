/* src/sequence.ts
	Read a folder of images into a sequence */

import { promises as fs } from "fs";
import path from "path";

import { settings } from "./index";

/** Collection of tiles that make up an animation */
export interface Sequence {
	name: string;
	images: Buffer[];
}
/** List of sequences */
export type SequenceList = Sequence[];

/** Get the number of sequences in a sequence list */
export function sequenceListLength(sequences: SequenceList): number { return sequences.length; }
/** Get the longest length list of tiles in a list of sequences */
export function maximumSequenceImageCount(sequences: SequenceList): number {
	let max = 0;
	for (const sequence of sequences)
		if (max < sequence.images.length)
			max = sequence.images.length;
	return max;
}

/** Read sequences from a folder */
export async function readSequences(dir: string, extensions: string[] = ["png", "jpg", "jpeg"]): Promise<SequenceList> {
	dir = resolve(dir);

	const sequences: SequenceList = [];
	await findSequencesRecursive(dir, dir, extensions, sequences);

	return sequences;
}

async function findSequencesRecursive(root: string, dir: string, extensions: string[], sequences: SequenceList): Promise<void> {
	let files: string[] = await fs.readdir(dir, { encoding: "utf-8" }); // @throws
	files = files.sort();

	const sequence: Sequence = {
		name: relative(root, dir),
		images: []
	};

	const promises: Promise<void>[] = [];
	for (const file of files) {
		const fileResolved = resolve(dir, file);
		const fileRelative = relative(root, fileResolved);
		const fileExt = path.extname(fileResolved).replace(/^\./, "");

		promises.push(loadSequencesRecursive(root, fileResolved, fileRelative, fileExt, extensions, sequence, sequences));
	}

	await Promise.all(promises);

	if (sequence.images.length !== 0) {
		if (settings.verbose) console.log(`Completed sequence "${sequence.name}"`);
		sequences.push(sequence);
	}
}

async function loadSequencesRecursive(root: string, fileResolved: string, fileRelative: string, fileExt: string, extensions: string[], sequence: Sequence, sequences: SequenceList) {
	const fileInfo = await fs.stat(fileResolved); // @throws

	if (fileInfo.isFile()) {
		if (!extensions.includes(fileExt)) return;

		if (settings.verbose) console.log(`Adding file "${fileRelative}" to sequence "${sequence.name}"...`);

		try {
			const image: Buffer = await fs.readFile(fileResolved, { encoding: null });
			sequence.images.push(image);
		} catch (err) {
			console.error(`Failed to read image file "${fileRelative}":`, err.message as string);
			process.exit(1);
		}
	} else if (fileInfo.isDirectory()) {
		try {
			await findSequencesRecursive(root, fileResolved, extensions, sequences);
		} catch (err) {
			console.warn(`Failed to enumerate directory "${fileRelative}":`, err.message as string);
		}
	}
}

function resolve(...paths: string[]): string {
	return path.resolve.apply(path, paths);
}
function relative(from: string, to: string): string {
	return path.relative.apply(path, [resolve(from), resolve(to)]);
}
