# lrc-offset

## Usage

```shell
git clone https://github.com/k34869/lrc-offset.git
cd lrc-offset
npm install
npm link
lrc-offset
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