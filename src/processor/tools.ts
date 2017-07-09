import { IResult, IOption } from "../types"
export function grep(op: { strings: [string] }, list: IResult[]): IResult[] {
  let test: RegExp = new RegExp(op.strings.join(" "))
  return list.filter(item => test.test(item.value))
}
export function head(op: { strings: [string] }, list: IResult[]): IResult[] {
  let n = Number(op.strings[0])
  if (n > list.length) {
    return [...list]
  }
  return list.slice(0, n)
}
export function tail(op: { strings: [string] }, list: IResult[]): IResult[] {
  let n = Number(op.strings[0])
  if (n > list.length) {
    return [...list]
  }
  return list.slice(-n, list.length)
}
export function count(op: IOption, list: IResult[]) {
  return [{
    title: "Count",
    text: list.length,
    value: list.length
  }]
}
export function now() {
  let d = new Date()
  return [{
    title: "Now",
    text: d.toLocaleString(),
    value: d.getTime()
  }]
}
const scalc = require("scalc")
export function calc(op: IOption) {
  let exp = op.strings.join(" ").trim()
  if (exp.length) {
    let result = scalc(exp)
    return [{
      title: result,
      text: `${exp} = ${result}`,
      value: ""
    }]
  } else {
    return [{
      title: "Calculator",
      text: "Calculate math expression"
    }]
  }
}
