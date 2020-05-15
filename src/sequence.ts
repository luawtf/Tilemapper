/* src/readsequences.ts
	Read folders of images in as a sequence */

import { promises as fs } from "fs";
import path from "path";

export interface Sequence {
	name: string;
	images: Buffer[];
}
export type SequenceList = Sequence[];

export function sequenceListLength(sequences: SequenceList): number {
	return Object.values(sequences).length;
}
export function maximumSequenceImageCount(sequences: SequenceList): number {
	let max = 0;
	for (const sequence of sequences)
		if (max < sequence.images.length)
			max = sequence.images.length;
	return max;
}

export async function readSequences(dir: string, extensions: string[] = ["png", "jpg", "jpeg"]): Promise<SequenceList> {
	dir = resolve(dir);

	const sequences: SequenceList = [];
	await findSequencesRecursive(dir, dir, extensions, sequences);

	return sequences;
}

async function findSequencesRecursive(root: string, dir: string, extensions: string[], sequences: SequenceList): Promise<void> {
	const files: string[] = await fs.readdir(dir, { encoding: "utf-8" }); // @throws

	const sequence: Sequence = {
		name: relative(root, dir),
		images: []
	};

	const promises: Promise<void>[] = [];
	for (const file of files) {
		const fileResolved = resolve(dir, file);
		const fileExt = path.extname(fileResolved).replace(/^\./, "");

		promises.push(loadSequencesRecursive(root, fileResolved, fileExt, extensions, sequence, sequences));
	}

	await Promise.all(promises);

	if (sequence.images.length !== 0) {
		sequences.push(sequence);
	}
}

async function loadSequencesRecursive(root: string, fileResolved: string, fileExt: string, extensions: string[], sequence: Sequence, sequences: SequenceList) {
	const fileInfo = await fs.stat(fileResolved); // @throws

	if (fileInfo.isFile()) {
		if (!extensions.includes(fileExt)) return;
		try {
			const image: Buffer = await fs.readFile(fileResolved, { encoding: null });
			sequence.images.push(image);
		} catch (err) {
			// TODO: Warn the user
		}
	} else if (fileInfo.isDirectory()) {
		try {
			await findSequencesRecursive(root, fileResolved, extensions, sequences);
		} catch (err) {
			// TODO: Warn the user
		}
	} else {
		// TODO: Warn the user
	}
}

function resolve(...paths: string[]): string {
	return path.resolve.apply(path, paths);
}
function relative(from: string, to: string): string {
	return path.relative.apply(path, [resolve(from), resolve(to)]);
}
