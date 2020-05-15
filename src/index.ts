/* src/index.ts
	Application entrypoint */

import { readFilesFromDir } from "./readdir";

console.log(readFilesFromDir("./test"));
