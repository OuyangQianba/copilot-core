// const spawn = require("child_process").spawn
import { spawn } from "child_process"
import * as fs from "fs"
import * as util from "util"
import * as os from "os"
const helper = {
  path: (str: string) => {
    return str.replace(/^\s*~/, os.homedir)
  },
  exec: (command: string, args: any, options = {}) => new Promise((res: (_: string) => void, rej) => {
    let arg = util.isArray(args) ? args : [args]
    let cmd = spawn(command, arg, options)
    let errorStr = ""
    let stdout = ""
    cmd.stderr.on("data", (data: Buffer) => {
      errorStr += data
    })
    cmd.stdout.on("data", (data: Buffer) => {
      stdout += data.toString()
    })
    cmd.on("close", (code: number) => {
      if (code === 0) {
        res(stdout)
      } else {
        rej({
          code,
          errorStr
        })
      }
    })
  }),
  sh: (command: string, args: any) => helper.exec(command, args, { shell: true }),

  promisify: (api: Function) => (...param: any[]) => new Promise((res: (...arg: any[]) => void, rej) => {
    api(...param, (err: any, ...rest: any[]) => {
      if (err) {
        rej(err)
      } else {
        res(...rest)
      }
    })
  })
}
type API = () => any
export const stat: (path: string | Buffer) => Promise<fs.Stats> = helper.promisify(fs.stat)
export const readdir: (path: string | Buffer) => Promise<string[]> = helper.promisify(fs.readdir)
export const readFile: (path: string, encoding: string) => Promise<string> = helper.promisify(fs.readFile)
export default helper
export const utils = helper
export function cmdsRequired(cmds: string[], fn: any, errors: string[] = []) {
  //TODO:crose-platform
  let error = ""
  let canUse = true
    ; (async () => {
      try {
        await Promise.all(cmds.map(async (cmd, idx) => {
          try {
            await utils.exec("which", cmd)
          } catch (e) {
            error = errors[idx] || `${cmd} is missing,please to install it`
            throw e
          }
        }))
      } catch (e) {
        canUse = false
      }
    })()

  return function cmdsReqWrapper(...args) {
    if (canUse) {
      return fn.apply(this, args)
    } else {
      return [{
        text: error,
        value: error
      }]
    }
  }
}
export function speicalSplit(str: string, by: RegExp = /\s/) {
  //TODO:consider escape
  let parts = []
  let currentPart = ""
  let inStr = 1;
  let inSingleQuotedStr = 2;
  let state = 0;
  let init = 0;

  for (let i = 0; i < str.length; i++) {
    let char = str.charAt(i)
    switch (state) {
      case inStr:
        if (char === '"') {
          state = init
        }
        currentPart += char
        break
      case inSingleQuotedStr:
        if (char === "'") {
          state = init
        }
        currentPart += char
        break
      case init:
        if (char === '"') {
          state = inStr;
        } else if (char === "'") {
          state = inSingleQuotedStr
        } else if (by.test(char)) {
          parts.push(currentPart)
          currentPart = ""
          continue
        }
        currentPart += char
    }
  }

  if (currentPart) {
    parts.push(currentPart)
  }
  return parts;
}