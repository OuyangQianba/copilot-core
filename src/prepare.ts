//alias replace
/**
 * alias
 * alias to processor
 * a -> buidin.win.active
 * a google-chrome -> wins | search -f google-chrome | buidin.win.active
 *                 -> buidin.win.list | buidin.filter.search -f google-chrome | buidin.win.active
 */
//pipe split

import { getAlias } from "./config"
const { debug } = require("b-logger")("copilot.prepare")
import { speicalSplit } from "./util"
export interface IPrepared {
  cmd: string,
  rest: string
}

function split(cmd: string) {
  //debug("split:", cmd)
  //TODO: better split
  return cmd.trim().split("|")
    .map(e => {
      e = e.trim()
      let space = e.indexOf(" ")
      if (space > 0) {
        return {
          cmd: e.substring(0, space),
          rest: e.substring(space)
        }
      }
      return {
        cmd: e,
        rest: ""
      }
    })
}

export function prepare(cmd: string): IPrepared[] {
  let alias = getAlias()
  let flag = true
  let ret: IPrepared[] = split(cmd)
  while (flag) {
    flag = false
    debug("before apply:", ret)
    for (let e of ret) {
      if (e.cmd in alias) {
        e.cmd = alias[e.cmd]
        let args = speicalSplit(e.rest.trim());
        e.cmd = e.cmd.replace(/__arg[0-9]+__/g, (m) => {
          let idx = +m.replace(/[^\d]/g, "") - 1
          if (idx < args.length) {
            let replace = args[idx]
            args[idx] = 0
            return replace;
          }
          return m;
        })
        args = args.filter(i => i)
        if (e.cmd.includes("__arg__")) {
          e.cmd = e.cmd.replace(/__arg__/g, args.join(" "))
          args = []
        }
        e.rest = args.join(" ")
        flag = true
      }
    }
    debug("alias applied:", ret)
    if (flag) {
      cmd = ret.reduce((ret: any, next) =>
        (ret += next.cmd + " " + next.rest + " |", ret), "")
      ret = split(cmd.substr(0, cmd.length - 1))
    }
  }
  debug(`Convert ${cmd} to \n`, ret)
  return ret
}
