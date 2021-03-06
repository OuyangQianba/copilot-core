import { getServices } from "../config"
const EventEmitter = require("events");
const { debug, error } = require("b-logger")("copilot.services.socketio")
const server = require("http").createServer();
let port = 9999
try {
  port = getServices().socketio.port as number
} catch (e) {
  debug("Failed to get port from config,", e)
}

server.listen(port, (e: any) => error)

const io = require("socket.io")(server)

export interface ISocketIOParam {
  namespace: string
}
export interface IClient {
  send(event: string, msg: any): void,
  onJson(event: string, cb: (arg: any) => void): void,
  on(event: string, cb: (_: any) => void): void,
  close(): void
}
export interface ISocket {
  on<T>(event: string, cb: (arg: T) => void): void,
  emit(event: string, msg: any): void
}
export class SocketIO implements ISocket {
  private events: typeof EventEmitter
  private io: any
  constructor({ namespace }: ISocketIOParam) {
    this.events = new EventEmitter()
    this.io = io.of(namespace)
    this.io.on("connection", (client: IClient) => {
      debug("client connected")
      this.events.emit("connection", {
        send(event: string, msg: any) {
          client.send(event, msg)
        },
        on(event: string, cb: (_: any) => void) {
          client.on(event, cb)
        },
        onJson(event: string, cb: (_: any) => void) {
          client.on(event, (arg: string) => {
            cb(JSON.parse(arg))
          })
        }
      })
    })
  }

  public on<T>(event: string, cb: (arg: T) => void) {
    this.events.on(event, cb)
  }
  public emit(event: string, msg: any) {
    this.io.emit(event, msg)
  }
}

const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });
const { debug: wsDebug } = require("b-logger")("copilot.services.WebSocket")
//Event Oriental Light-weight WebSocket
export class EOLWebSocket implements ISocket {
  private events: typeof EventEmitter
  constructor({ namespace }: ISocketIOParam) {
    wsDebug("namespace", namespace)
    this.events = new EventEmitter()
    wss.on("connection", (ws: any, req: any) => {
      wsDebug(req.url)
      wsDebug(req.url.substring(1).replace(/\\/g, "."))
      if (req.url.substring(1).replace(/\\/g, ".") === namespace) {
        wsDebug("client connected")
        let clientEvents: typeof EventEmitter = new EventEmitter()
        ws.on("message", (data: string | Buffer) => {
          if (typeof data === "string") {
            let json = JSON.parse(data)
            clientEvents.emit(json.event, json.data)
          }
        })
        ws.on("close", () => {
          wsDebug("close")
          this.events.emit("close")
        })
        this.events.emit("connection", {
          on(event: string, cb: (_: any) => void) {
            ws.on(event, cb)
          },
          send(event: string, data: any) {
            ws.send(JSON.stringify({
              event,
              data
            }))
          },
          onJson(event: string, cb: (arg: any) => void) {
            clientEvents.on(event, cb)
          },
          close() {
            ws.terminate()
          }
        })
      }
      wsDebug("connected")
    })
  }
  public on<T>(event: string, cb: (arg: T) => void) {
    this.events.on(event, cb)
  }
  public emit(event: string, msg: any) {

  }
}
