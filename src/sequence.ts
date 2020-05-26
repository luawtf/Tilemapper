/* src/sequence.ts
	Read a folder of images into a sequence */

import { promises as fs } from "fs";
import path from "path";

import { verbose, config } from "./index";

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

	if (sequences.length < 1)
		throw new Error("No sequences found");

	if (verbose) console.log("Loaded %d sequences from the disk", sequences.length);

	return sequences;
}

async function findSequencesRecursive(root: string, dir: string, extensions: string[], sequences: SequenceList): Promise<void> {
	let files: string[];
	try {
		files = await fs.readdir(dir, { encoding: "utf-8" });
		files = files.sort((a, b) => {
			if (config.numsort) {
				a = padNumbers(a);
				b = padNumbers(b);
			}
			return a.localeCompare(b);
		});
	} catch (err) {
		console.warn("Warning: Failed to enumerate directory '%s'", relative(root, dir));
		return;
	}

	if (verbose) console.log("Checking for images in '%s'...", relative(root, dir));

	const sequence: Sequence = {
		name: relative(root, dir),
		images: []
	};

	for (const file of files) {
		const fileResolved = resolve(dir, file);
		const fileRelative = relative(root, fileResolved);
		const fileExt = path.extname(fileResolved).replace(/^\./, "");

		await loadSequencesRecursive(root, fileResolved, fileRelative, fileExt, extensions, sequence, sequences);
	}

	if (sequence.images.length !== 0) {
		sequences.push(sequence);
	}
}

async function loadSequencesRecursive(root: string, fileResolved: string, fileRelative: string, fileExt: string, extensions: string[], sequence: Sequence, sequences: SequenceList): Promise<void> {
	const fileInfo = await fs.stat(fileResolved);

	if (fileInfo.isFile()) {
		if (!extensions.includes(fileExt)) return;

		const image: Buffer = await fs.readFile(fileResolved, { encoding: null });
		sequence.images.push(image);

		if (verbose) console.log("Loaded image '%s'", fileRelative);
	} else if (fileInfo.isDirectory()) {
		await findSequencesRecursive(root, fileResolved, extensions, sequences);
	}
}


const padNumbersRegex = /\d+(?=.*$)/;
const padNumbersCount = 10;
/**
 * Find and pad the last set of numbers in a string
 *
 * Converts something like `hello10-2.png` to `hello10-0000000002.png`
 */
function padNumbers(str: string): string {
	const execArray = padNumbersRegex.exec(str);
	if (!execArray) return str;

	const matched: string = execArray[0];
	const matchedIndex: number = execArray.index;

	const padCount = padNumbersCount - matched.length;
	const zeros: string = "0".repeat(padCount);

	return str.slice(0, matchedIndex) + zeros + str.slice(matchedIndex);
}

function resolve(...paths: string[]): string {
	return path.resolve.apply(path, paths);
}
function relative(from: string, to: string): string {
	return path.relative.apply(path, [resolve(from), resolve(to)]);
}
