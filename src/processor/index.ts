import * as fs from "fs"
import { readdir, stat } from "../util"
import * as utils from "../util"
import * as util from "util"
import * as path from "path"
import { Check, InvalidResult, Processor, ProcessorName } from "../types"
import { getConfig } from "../config"
import { getServices } from "../services"
import { nameFn, prefix } from "../util/ProcessorName"
const logger = require("b-logger")
const { asyncify } = require("array-asyncify")
const { debug, warn, error } = logger("processor.loader")
// const readdir: (path: string | Buffer) => Promise<string[]> = utils.promisify(fs.readdir)

interface IParsed {
  processors?: { [name: string]: Processor },
  errors?: Array<{ name: string, msg: string }> | string
}
function isCheckResultArray(x: any): x is InvalidResult[] {
  return x instanceof Array
}

function validProcessorName(name: string) {
  let specialName = ["check", "init", "declare"]
  return !specialName.includes(name) && !/_$/.test(name)
}

async function parse(
  obj: any,
  fileName: string,
  name: nameFn): Promise<IParsed> {
  const processors: { [name: string]: Processor } = {}
  //inject services and config
  let param = {
    cfg: getConfig(name(fileName, "").replace(/\.$/, "")),
    services: {}
  }
  if (obj.declare && util.isFunction(obj.declare)) {
    let declare = obj.declare()
    declare.params = declare.params || {}
    debug("declared dependencies:", declare)
    if (declare.services) {
      param.services = declare.services
        .map((serviceName: string) => {
          let serviceParam = declare.params[serviceName] || {}
          return {
            key: serviceName,
            value: getServices(serviceName, {
              ...serviceParam,
              namespace: name(fileName, "")
            })
          }
        })
        .reduce((ret: any, next: any) => (ret[next.key] = next.value, ret), {})
    }
  }

  if (obj.init && util.isFunction(obj.init)) {
    await obj.init(param)
  }
  if (obj.check && util.isFunction(obj.check)) {
    const check = obj.check as Check
    const checkResult = await check()
    if (checkResult) {
      if (isCheckResultArray(checkResult)) {
        const invalid = checkResult as InvalidResult[]
        Object.keys(obj)
          .filter((key) => validProcessorName(key) && invalid.every(e => e.key !== key))
          .map(key => obj[key].bind(obj))
          .forEach(fun => {
            processors[name(fileName, fun.name).replace(/\.default$/, "")] = fun
          })
        return {
          processors,
          errors: invalid.map(e => ({ name: e.key, msg: e.msg })),
        }
      } else {
        if (checkResult.valid) {
          Object.keys(obj)
            .filter(key => validProcessorName(key) && util.isFunction(obj[key]))
            .map(key => obj[key].bind(obj))
            .forEach(fun => {
              debug(`Load processor ${fun.name}`)
              processors[name(fileName, fun.name)] = fun
            })
        } else {
          return {
            errors: checkResult.msg,
          }
        }
      }
    }
  } else {
    warn(`check return falsy. ${fileName}`)
    debug(Object.keys(obj))
    Object.keys(obj)
      .map(key => {
        debug(`${key} is function:`, util.isFunction(obj[key]))
        return key
      })
      .filter(key => validProcessorName(key) && util.isFunction(obj[key]))
      // .map(key => obj[key].bind(obj))
      .forEach(key => {
        let fun = obj[key]
        processors[name(fileName, key).replace(/\.default$/, "")] = fun.bind(obj)
      })
  }
  return { processors }
}

export async function load({
  dir = __dirname,
  name = (fileName: string, processorName: string) =>
    `buildin.${fileName}.${processorName.replace("bound ", "")}` }) {
  debug(`Load processors from ${dir}`)
  let files = await readdir(dir)
  let processors: { [name: string]: Processor } = {}
  let errors: {
    [filename: string]: Array<{ name: string, msg: string }> | string
  } = {}

  let modules = await asyncify(files)
    .filter(async (file: string) => {
      debug("filter", file)
      if (/\.js$/.test(file) && file !== "index.js") {
        return true
      } else {
        return (await stat(`${dir}/${file}`)).isDirectory()
      }
    })
    .map((file: string) => {
      try {
        let ret = {
          module: require(`${dir}/${file}`),
          name: path.parse(file).name
        }
        return ret
      } catch (e) {
        error(`Failed to load ${dir}/${file}`, e)
      }
    })
    .filter((i: any) => i)
  debug("Modules:", modules)
  for (const item of modules) {
    let { module, name: fileName } = item
    if (util.isFunction(module)) {
      module = module({
        logger,
        utils
      })
    }
    debug(`Load ${fileName}`)
    if ("default" in module) {
      const defvalue = module.default
      if (util.isFunction(defvalue)) {
        processors[name(fileName, defvalue.name)] = defvalue
        continue;
      } else {
        module = defvalue
      }
    }
    try {
      const parsed = await parse(module, fileName, name)
      if (parsed.processors) {
        Object.assign(processors, parsed.processors)
      }
      if (parsed.errors) {
        errors[fileName] = parsed.errors
      }
    } catch (e) {
      error(e)
      errors[path.resolve(`${dir}/${fileName}`)] = `Failed to load processor from file ${fileName},${e}`
    }
  }
  return {
    processors,
    errors,
  }
}
