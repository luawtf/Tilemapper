# Tilemapper
*Generate a tilemap from folders containing frames of animation or just multiple images.*

Tilemapper recursively converts folders of images (tiles) into a tilemap.

So, for example, using the directory `root/`:
```
root/
	anim1/
		1.png
		2.png
		3.png
		4.png
		subanim1/
			a.png
			b.png
			c.png
			d.png
	anim2/
		frame1.jpg
		frame2.jpg
		frame3final.jpg
		frame4.jpg
```
It will produce a 4x3 tilemap like this:
```
[ anim1's frames ]
[    subanim1    ]
[     anim2      ]
```

## Screenshots
![Screenshot](./screenshot.png)

## Installation
Requires any semi-recent version of [Node.js](https://nodejs.org/) (which comes with NPM).
```sh
npm install -g tilemapper
```

## Usage
Invoke Tilemapper with the `tilemapper` command.
```
Usage:
    tilemapper [options] <directory>

Options:
    -h,-?,--help        Print this help message
    -V,--version        Print version information

    -v,--verbose        Output verbose logging information

    -o,--output         Output file path (default "tilemap.png")

    -w,--width          Tile width in pixels (default 60)
    -h,--height         Tile height in pixels (default 60)

    --minimum-x         Minimum tilemap tile count on the X axis (default 0)
    --minimum-y         Minimum tilemap tile count on the Y axis (default 0)

    -f,--fit            Tile libvips fit mode
                            One of: "contain", "cover", "fill", "inside",
                            "outside"
    -k,--kernel         Tile libvips kernel format
                            One of: "nearest", "cubic", "mitchell", "lanczos2",
                            "lanczos3"

Version:
    tilemapper v2.0.0
```

## Authors
Made with ❤ by Jack MacDougall ([lua.wtf](https://lua.wtf/))

## License
This project is licensed under [MIT](LICENSE).
More info in the [LICENSE](LICENSE) file.

*"A short, permissive software license. Basically, you can do whatever you want as long as you include the original copyright and license notice in any copy of the software/source.  There are many variations of this license in use."* - [tl;drLegal](https://tldrlegal.com/license/mit-license)
