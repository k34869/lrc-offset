# lrc-offset

LRC lyrics timestamp offset tool.

## Usage

Depends on the ffmpeg toolkit

```shell
npm install lrc-offset -g

# input lyric type file offset 0.25 seconds output music-out.lrc
lrc-offset music.lrc -s 0.25 -o music-out.lrc
# input embed type file offset -0.5 seconds output template file
lrc-offset music.mp3 -s -0.5 -o 
```

## Help

```
Usage: lrc-offset [options] [command] <input>

LRC lyrics timestamp offset tool.

Arguments:
  input                      input source

Options:
  -V, --version              output the version number
  -t, --type <type-keyword>  input type(lyric | embed | other | auto)
  -s, --offset <offset>      lyrics timestamp offset( value: second )
  -o, --output [path]        output file
  -c, --convert [format]     output conversion format
  --save [isSave]            do you want to save the changes
  --show-diff [isShowDiff]   show diff information
  -h, --help                 display help for command

Commands:
  export-before-save         do you want to save the changes
```