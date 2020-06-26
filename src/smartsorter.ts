/* src/smartsorter.ts
	Sort a list of filenames based on [name, number, direction] */

/** Cardinal directions enumeration */
enum Direction { Up, Right, Down, Left };
/** Map of English words to directions */
const directionMap: { [str: string]: Direction } = {
	"up": Direction.Up, "forward": Direction.Up,
	"top": Direction.Up, "north": Direction.Up,
	"front": Direction.Up,
	"down": Direction.Down, "backward": Direction.Down,
	"bottom": Direction.Down, "south": Direction.Down,
	"back": Direction.Down,
	"left": Direction.Left, "west": Direction.Left,
	"right": Direction.Right, "east": Direction.Right
};
/** Attempt to convert a string to a direction */
function asDirection(str: string): Direction | null {
	return directionMap[str] ?? null;
}

/** Type of string segment */
enum SegmentType { Word, Direction, Number, Separator, Null }
/** Segment tuple definition */
type Segment = [SegmentType, string | number];

/** Regular expression that matches the 3 main types of separator */
const segmentRegexp = /([a-zA-z]+)|([0-9]+)|([^a-zA-Z0-9]+)/g;
/** Split a string into segments */
function segmentize(str: string): Segment[] {
	const segments: Segment[] = [];
	let i = 0;

	// Reset the regular expression's last index
	segmentRegexp.lastIndex = 0;

	let result: RegExpExecArray | null = null;
	while ((result = segmentRegexp.exec(str)) !== null) {
		// Unpack this result
		const wordVal: string | undefined = result[1];
		const numberVal: string | undefined = result[2];
		const separatorVal: string | undefined = result[3];

		// Generate segment
		let segment: Segment;
		if (wordVal) {
			const strVal = wordVal.toLowerCase();
			const directionVal = asDirection(strVal);
			if (directionVal) {
				segment = [SegmentType.Direction, directionVal];
			} else {
				segment = [SegmentType.Word, strVal];
			}
		} else if (numberVal) {
			segment = [SegmentType.Number, Number(numberVal)];
		} else if (separatorVal) {
			segment = [SegmentType.Separator, separatorVal];
		} else {
			segment = [SegmentType.Null, ""];
		}

		// Push this segment
		segments[i++] = segment;
	}

	return segments;
}

/** Compare two segment lists against eachother */
function compareSegmentLists(a: Segment[], b: Segment[]): (-1 | 0 | 1) {
	const length = Math.max(a.length, b.length);

	// Loop over all segments in each segment list
	for (let i = 0; i < length; i++) {
		// Unpack segments
		const sA: Segment | undefined = a[i];
		const sB: Segment | undefined = b[i];

		// If we've reached the end, sort by length
		if (sA === undefined) return -1;
		if (sB === undefined) return 1;

		// Unpack types and values
		const aType = sA[0]; const aVal = sA[1];
		const bType = sB[0]; const bVal = sB[1];

		// Sort by type if types don't match
		if (aType !== bType) {
			if (aType > bType) return 1;
			if (aType < bType) return -1;
		}

		// Sort by segment value
		if (aType === SegmentType.Word || aType === SegmentType.Direction || aType === SegmentType.Number) {
			if (aVal > bVal) return 1;
			if (aVal < bVal) return -1;
		}
	}

	return 0;
}

/**
 * SmartSorter provides alphanum-like comparison function that caches its inputs and results
 * NOTE: All inputs are cached by SmartSorter for speed, and are never deleted/flushed, please make sure all SmartSorter instances are short lived!
 */
export class SmartSorter {
	/** Cache of segment lists for inputs */
	private segmentListCache: { [str: string]: Segment[] | undefined } = {};
	/** Generate a segment list from a string, or used a cached version if possible */
	private toSegmentList(str: string): Segment[] {
		const cached = this.segmentListCache[str];
		if (cached) return cached;

		return this.segmentListCache[str] = segmentize(str);
	}

	/** Compare two strings */
	compare(a: any, b: any): (-1 | 0 | 1) {
		if (typeof a !== "string") a = String(a);
		if (typeof b !== "string") b = String(b);

		const segmentListA = this.toSegmentList(a);
		const segmentListB = this.toSegmentList(b);

		return compareSegmentLists(segmentListA, segmentListB);
	}
}
