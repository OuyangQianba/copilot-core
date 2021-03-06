import { exec, cmdsRequired } from "../../util"
import { IOption } from "../../types"
const { debug } = require("b-logger")("copilot.sys.linux")

export
  function suspend() {
  return [{
    title: "Supend",
    text: "Suspend system",
    value: "Suspend system",
    param: {
      action: "cmd",
      cmd: "systemctl",
      args: ["suspend"]
    }
  }]
}
export function reboot() {
  return [{
    title: "Reboot",
    text: "Reboot system",
    value: "Reboot system",
    param: {
      action: "cmd",
      cmd: "systemctrl",
      args: ["reboot"]
    }
  }]
}

export function xkill() {
  return [{
    title: "Kill",
    param: {
      action: "cmd",
      cmd: "xkill"
    }
  }]
}

export function mute() {
  return [{
    title: "Mute",
    text: "Close audio output"
  }]
}

export const wifi = cmdsRequired(["pkexec", "iw", "ip", "awk", "sh"], async function wifi(opt: IOption) {
  let ifs: string[]
    = (await exec("sh", ["-c", "iw dev | grep Interface | awk '{print $2}'"]))
      .split("\n")
      .filter(i => i)
  let status = (await exec("sh", ["-c", " ip link show | grep '^[0-9]'"]))
    .split("\n")
    .map(line => line.split(/\s+/))
    .filter(a => a.length >= 3)
    .map(([id, name, statusStr]) => {
      return {
        name: name.substring(0, name.length - 1),
        up: statusStr.includes("UP")
      }
    })
    .reduce((i: any, ret) => (i[ret.name] = ret, i), {})
  debug("", ifs, status)

  return ifs.map(i => ({
    text: `Turn  ${i} ${status[i].up ? "down" : "up"}`,
    param: {
      action: "cmd",
      cmd: "pkexec",
      args: ["ip", "link", "set", i, status[i].up ? "down" : "up"]
    }
  }))
},
  ["pkexec is missing,install policykit please"]
)
export const ip = cmdsRequired(["ifconfig", "awk", "sh"], async function ip() {
  let ifs: Array<{ name: string, RXOK: number, ip: string }>
    = (await exec("ifconfig", ["-s"]))
      .split("\n")
      .slice(1)
      .map(line => line.split(/\s+/))
      .map(([name, mtu, met, RXOK, RXERRR]) => ({ name, RXOK: +RXOK, ip: "" }))
      .filter(i => i.name)
      .sort((a, b) => b.RXOK - a.RXOK)

  for (let i of ifs) {
    try {
      i.ip = (await exec("ifconfig", [i.name]))
        .split("\n")
        .filter(line => /inet addr/.test(line))
        .map(line => /\d*\.\d*\.\d*\.\d*/.exec(line))
        .filter(item => item)
        .map(line => (debug(line), line))
        .map(item => item[0])[0]
    } catch (e) {
      debug(e)
    }
  }

  return ifs
    .filter(i => i.ip)
    .map(i => ({
      title: i.name,
      text: i.ip
    }))
})

export async function bc(opt: IOption) {
  let ret = await exec("sh", [
    "-c", "echo 1+2 | bc"
  ])
  return [{
    text: ret,
  }]
}
