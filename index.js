#!/usr/bin/env node
const package = require('./package.json')
if (process.argv.slice(2).length === 0) {
    console.log(
        'Usage: ' + package.name + ' <input-file> [-s <offset>] [-o <output-file>]\n' +
        'Description: ' + package.description + '\n' +
        'Version: ' + package.version
    )
    process.exit(0)
}
const { sync: whichSync } = require('which')
if (whichSync('ffprobe', {nothrow: true}) === null) error(`The 'ffprobe' executable file is missing. Please add the 'ffprobe' executable file to the environment variable 'PATH'`)
if (whichSync('ffmpeg', {nothrow: true}) === null) error(`The 'ffmpeg' executable file is missing. Please add the 'ffmpeg' executable file to the environment variable 'PATH'`)
const fs = require('fs')
const { parse, resolve } = require('path')
const { program } = require('commander')
const { question } = require('readline-sync')
const { execSync } = require('child_process')
const { error } = require('./lib/stdan.js')
const config = require('./config.json')

/** 
 * timeSeq 时间戳计算
 * @param {String} timeStr lrc时间戳格式, 如 01:12.05
 * @param {Number} secondsToAdd 增加的秒数(可以为负数), 如 2.14
 * @returns {String} 计算后的lrc时间戳格式
*/
function timeSeq(timeStr, secondsToAdd) {
    let timeParts = timeStr.split(':')
    let hours = parseInt(timeParts[0])
    let minutes = parseFloat(timeParts[1])
    let seconds = parseFloat(timeParts[2])
    let totalSeconds = hours * 3600 + minutes * 60 + seconds + parseFloat(secondsToAdd)
    let newHours = Math.floor(totalSeconds / 3600)
    let newMinutes = Math.floor((totalSeconds % 3600) / 60)
    let newSeconds = totalSeconds % 60
    let formattedHours = (newHours < 10 ? '0' : '') + newHours
    let formattedMinutes = (newMinutes < 10 ? '0' : '') + newMinutes
    let formattedSeconds = (newSeconds < 10 ? '0' : '') + newSeconds.toFixed(2)
    let newTimeStr = formattedHours + ':' + formattedMinutes + ':' + formattedSeconds
    return newTimeStr
}

/** 
 * convertToHMS 将 MMSS 时间戳格式转换为 HMS 格式
 * @param {String} timeStr MMSS 时间戳格式, 如 01:12.05
 * @returns {String} HMS 时间戳格式, 如 01:08:12.05
*/
function convertToHMS(timeStr) {
    let timeParts = timeStr.split(':')
    let minutes = parseInt(timeParts[0])
    let seconds = parseFloat(timeParts[1])
    let hours = Math.floor(minutes / 60)
    minutes = minutes % 60
    let formattedHours = (hours < 10 ? '0' : '') + hours
    let formattedMinutes = (minutes < 10 ? '0' : '') + minutes
    let formattedSeconds = (seconds < 10 ? '0' : '') + seconds.toFixed(2)
    return formattedHours + ':' + formattedMinutes + ':' + formattedSeconds
}

/** 
 * convertToHMS 将 HMS 时间戳格式转换为 MMSS 格式
 * @param {String} timeStr HMS 时间戳格式, 如 01:08:12.05
 * @returns {String} MMSS 时间戳格式, 如 01:12.05
*/
function convertToMMSS(timeStr) {
    let timeParts = timeStr.split(':')
    let hours = parseInt(timeParts[0])
    let minutes = parseInt(timeParts[1])
    let seconds = parseFloat(timeParts[2])
    let totalMinutes = hours * 60 + minutes
    let formattedMinutes = (totalMinutes < 10 ? '0' : '') + totalMinutes
    let formattedSeconds = (seconds < 10 ? '0' : '') + seconds.toFixed(2)
    return formattedMinutes + ':' + formattedSeconds
}

/** 
 * getInputData 获取输入源歌词数据
 * @param {String} input 输入文件, 如 /xxx/xxx.lrc
 * @param {String} type 输入文件的类型( lyric, embed, other, auto )
 * @param {Boolean} isError 是否抛出错误
 * @returns {Object} 获取结果, {status, lrcData}
*/
function getInputData(input, type, isError) {
    function typeLyric(isError) {
        let data
        try {
            data = JSON.parse(execSync(`ffprobe -v quiet "${input}" -of json -show_format -show_error`).toString())
        } catch (err) {
            if (isError) 
                error(`'${input}': ${JSON.parse(err.stdout.toString()).error.string}`)
            else
                return {status: false, lrcData: null, type: 'unknown'}
        }
        if (data.format.format_name !== 'lrc') 
            if (isError) 
                error(`'${input}': is not a lyric type file`)
            else
                return {status: false, lrcData: null, type: 'unknown'}
        return {status: true, lrcData: fs.readFileSync(input, 'utf8'), type: 'lyric'}
    }
    function typeEmbed(isError) {
        let data
        try {
            data = JSON.parse(execSync(`ffprobe -v quiet "${input}" -of json -show_format -show_error`).toString())
            if (data.format.tags === undefined)
                if (isError) 
                    error(`'${input}': No embed lyrics were found`)
                else
                    return {status: false, lrcData: null, type: 'unknown'}
            else
                if (data.format.tags.LYRICS === undefined) 
                    if (isError) 
                        error(`'${input}': No embed lyrics were found`)
                    else
                        return {status: false, lrcData: null, type: 'unknown'}
            return {status: true, lrcData: data.format.tags.LYRICS, type: 'embed', streamIndex: data.format.nb_streams - 1, tags: data.format.tags}
        } catch (err) {
            if (isError) 
                error(`'${input}': ${JSON.parse(err.stdout.toString()).error.string}`)
            else
                return {status: false, lrcData: null, type: 'unknown'}
        }
    }
    function typeOther(isError) {
        let data
        try {
            data = JSON.parse(execSync(`ffprobe -v quiet "${input}" -of json -show_streams -show_error`).toString())
            for (let i = 0; i < data.streams.length; i++) {
                if (data.streams[i].codec_type === 'subtitle') {
                    try {
                        execSync(`ffmpeg -loglevel quiet -i "${input}" -map 0:${data.streams[i].index} "${resolve(__dirname, './cache/LYRICS-TEMP.lrc')}" -y`)
                        return {status: true, lrcData: fs.readFileSync(`${__dirname}/cache/LYRICS-TEMP.lrc`, 'utf8'), type: 'other', streamIndex: data.streams[i].index}
                    } catch (err) {
                        if (isError) 
                            error(err.message)
                        else
                            return {status: false, lrcData: null, type: 'unknown'}
                    }
                }
            }
        } catch (err) {
            if (isError) 
                error(`'${input}': ${JSON.parse(err.stdout.toString()).error.string}`)
            else
                return {status: false, lrcData: null, type: 'unknown'}
        }
        if (isError) 
            error(`'${input}': No streams found that can be converted to lyrics`)
        else
            return {status: false, lrcData: null, type: 'unknown'}
    }
    function typeAuto(isError) {
        let data = typeLyric(false)
        if (data.status) 
            return data
        else
            data = typeEmbed(false)
        if (data.status) 
            return data
        else
            data = typeOther(false)
        if (data.status) 
            return data
        else
            if (isError) 
                error(`'${input}': unknown type`)
            else
                return {status: false, lrcData: null, type: 'unknown'}
    }
    if (type === 'lyric') 
        return typeLyric(isError)
    else if (type === 'embed') 
        return typeEmbed(isError)
    else if (type === 'other') 
        return typeOther(isError)
    else if (type === 'auto') 
        return typeAuto(isError)
    else 
        if (isError) 
            error(`'${type}' is an unknown type keyword`)
        else
            return {status: false, lrcData: null, type: 'unknown'}
}

/** 
 * filenameParse 文件名解析
 * @param {String} filename 文件名
 * @param {String} convertFmt 转换格式, 修改文件后缀名
 * @param {Number} index 索引, 用于避免文件已存在
 * @returns {Object} 解析结果, { dir, name, index, ext }
*/
function filenameParse(filename, convertFmt, index = 1) {
    let { dir, name, ext } = parse(filename)
    if (convertFmt) ext = `.${convertFmt}`
    if (dir === '') dir = '.'
    if (fs.existsSync(`${dir}/${name}-${index + ext}`))
        return filenameParse(filename, convertFmt, ++index)
    else
        return { dir, name, index, ext }
}

/** 
 * lrcOutput 歌词输出
 * @param {String} file 输入文件
 * @param {String} res 输出结果
 * @param {String} output 输出文件的路径
 * @param {String} convertFmt 转换格式, 如 srt, vtt, ass...
 * @returns {void}
*/
function lrcOutput(file, res, output, convertFmt) {
    if (output && output !== '%NULL%') {
        let { name, dir, ext, index } = filenameParse(file)
        output = output.replace('${NAME}', name).replace('${DIR}', dir).replace('${EXT}', ext).replace('${INDEX}', index)
        if (resolve(output) === resolve(file)) 
            error(`output '${output}' cannot be the same as input '${file}'`)
        fs.writeFileSync(output, res, 'utf8')
        console.log(`INFO: '${file}' output -> '${output}'`)
        if (convertFmt) {
            let { dir, name, index, ext } = filenameParse(output, convertFmt)
            let convertFile = `${dir}/${name}-${index}${ext}`
            execSync(`ffmpeg -loglevel quiet -i "${output}" "${convertFile}" -y`)
            fs.unlinkSync(output)
            console.log(`INFO: '${output}' convert -> '${convertFile}'`)
        }
    } else {
        if (output !== '%NULL%')
            console.log(res)
    }
}

/**
 * saveChange 保存变更
 * @param {String} file 输入文件
 * @param {Object} res 修改后的结果
 * @returns {void}
*/
function saveChange(file, res) {
    if (res.type === 'lyric') {
        fs.copyFileSync(file, `${__dirname}/cache/SAVE-TEMP`)
        fs.writeFileSync(file, res.lrcData, 'utf8')
        console.log(`\nINFO: '${file}' save successfull`)
    } else if (res.type === 'embed') {
        const { ext } = parse(file)
        let metadata = ';FFMETADATA1\n'
        for (const key in res.tags) {
            if (key === 'LYRICS') 
                continue
            metadata += `${key}=${res.tags[key]}\n`
        }
        fs.writeFileSync(`${__dirname}/cache/ffmetadata.txt`, `${metadata}LYRICS=${res.lrcData.replace(/\n/g, '\\\n')}`)
        execSync(`ffmpeg -loglevel quiet -i "${file}" -i "${resolve(__dirname, './cache/ffmetadata.txt')}" -map_metadata 1 "${file}.temp${ext}" -y`)
        fs.renameSync(file, `${__dirname}/cache/SAVE-TEMP`)
        fs.writeFileSync(`${__dirname}/cache/SAVE-FILE.json`, JSON.stringify({file}))
        fs.renameSync(`${file}.temp${ext}`, file)
        console.log(`\nINFO: '${file}' save successfull`)
    } else if (res.type === 'other') 
        error(`'other' type cannot be saved directly`)
}

/**
 * exportBeforeSave 导出保存前的文件
 * @returns {void}
*/
function exportBeforeSave() {
    const { file } = require('./cache/SAVE-FILE.json')
    const { dir, ext } = parse(file)
    const next = question(`WARN: export file '${file}'. Do you confirm the operation(Y/n)? `)
    if (next === '' || next === 'Y' || next === 'y') {
        fs.rename(`${__dirname}/cache/SAVE-TEMP`, `${file}.export${ext}`, (err) => { 
            if (err) error(err.message)
            fs.writeFileSync(`${__dirname}/cache/SAVE-FILE.json`, JSON.stringify({file: {before: file, export: `${file}.before${ext}`}}, null, 2))
            fs.renameSync(`${__dirname}/cache/SAVE-FILE.json`, `${dir}/file.json`)
            console.log(`INFO: export file '${file}' export successfull`)
        })
    } else 
        console.log('INFO: export cancel')
}

/** 
 * lrcTimeOffset 歌词时间戳偏移
 * @param {String} file 输入文件
 * @param {Number} offset 偏移时间, 单位 ms
 * @param {String} output 输出文件
 * @param {String} convertFmt 转换格式, 如 srt, vtt, ass...
 * @param {String} type 输入文件的类型( lyric, embed, other, auto )
 * @returns {void}
*/
function lrcTimeOffset(file, offset = '0', output, convertFmt, type, isSave, isShowDiff) {
    fs.stat(file, (err, stats) => {
        if (err) 
            error(`'${file}': No such file`)
        else {
            if (stats.isDirectory()) 
                error(`'${file}': Is a directory`)
            else {
                let inRes = getInputData(file, type, true)
                let { lrcData } = inRes
                if (offset === '0') 
                    lrcOutput(file, lrcData, output, convertFmt)
                else {
                    let regex = /^\[[0-9]{1,}:[0-9]{1,2}(.[0-9]{1,}|)\]/
                    let res = ''
                    if (isNaN(Number(offset))) offset = '0'
                    lrcData.split('\n').forEach((e, i, arr) => {
                        e = `${e + (arr.length - 1 === i ? '' : '\n')}`
                        if (e.search(regex) === -1)
                            res += e
                        else {
                            let timer = e.match(regex)[0].replace(/(\[|\])/g, '')
                            res += e.replace(regex, `[${convertToMMSS(timeSeq(convertToHMS(timer), offset))}]`)
                        }
                    })
                    lrcOutput(file, res, output, convertFmt)
                    if (isShowDiff) {
                        let forward = inRes.lrcData.match(/\[[0-9]{1,}:[0-9]{1,2}(.[0-9]{1,}|)\]/g)
                        let back = res.match(/\[[0-9]{1,}:[0-9]{1,2}(.[0-9]{1,}|)\]/g)
                        forwardStart = forward[0]
                        forwardEnd = forward[forward.length - 1]
                        backStart = back[0]
                        backEnd = back[back.length - 1]
                        console.log(`\n${forwardStart} ${forwardEnd}\n -> ${offset} \n${backStart} ${backEnd}\n`)
                    }
                    if (isSave) {
                        inRes.lrcData = res
                        saveChange(file, inRes)
                    }
                }
            }
        }
    })
}

program
    .name(package.name)
    .version(package.version)
    .description(package.description)
    .argument('<input>', 'input source')
    .option('-t, --type <type-keyword>', 'input type(lyric | embed | other | auto)', config.inputType ?? 'auto')
    .option('-s, --offset <offset>', 'lyrics timestamp offset( value: second )')
    .option('-o, --output [path]', 'output file')
    .option('-c, --convert [format]', 'output conversion format')
    .option('--save [isSave]', 'do you want to save the changes', false)
    .option('-sd, --show-diff [isShowDiff]', 'show diff information', config.isShowDiff ?? false)
    .action((input, opts) => {
        try {
            if (opts.output === true) 
                opts.output = config.output === undefined ? './${NAME}-${INDEX}.lrc' : config.output
            else
                if (opts.convert) 
                    error(`'-c/--convert' must be used with '-o/--output'`)
            if (opts.convert === true) 
                opts.convert = config.convertFmt === undefined ? 'srt' : config.convertFmt
            lrcTimeOffset(input, opts.offset, opts.output, opts.convert, opts.type, opts.save, opts.showDiff)
        } catch (err) {
            error(err.message)
        }
    })

program
    .command('export-before-save')
    .description('do you want to save the changes')
    .action(() => {
        exportBeforeSave()
    })

program.parse()