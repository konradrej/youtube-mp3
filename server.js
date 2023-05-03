'use strict';


const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const express = require('express')
const Tiny = require('tiny')
const { exec } = require('child_process')
const fs = require('fs');
const sanitizeUrl = require("@braintree/sanitize-url").sanitizeUrl
const cron = require('node-cron')

// Constants
const PORT = 8080
const HOST = "0.0.0.0"
const COOKIE = process.env.SECRET

// DB
let db;
Tiny('data.tiny', function(err, _db) {
  if(err) throw err
  db = _db
})

// App
const app = express();
app.use(express.static('public'))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(verifyAccess)
app.use(errorHandler)

app.post("/api/request/", (req, res) => {
  try {
    const sanitizedUrl = processUrl(req.body.url)
    const uuid = getUuid(sanitizedUrl)

    let entry
    db.get(uuid, function(err, data){
      entry = err ? err : data
    })

    if(typeof entry === "undefined"){
      entry = generateEntry(uuid, sanitizedUrl.href)
    }

    // if not downloaded or in progress
    if(!entry.downloaded && !entry.inprogress){
      entry.inprogress = true
      db.set(uuid, entry)
    
      exec(`yt-dlp -f bestaudio --no-playlist -x --audio-format mp3 -o "./data/${uuid}/%(title)s.%(ext)s" ${sanitizedUrl.href}`, function(err, stdout, stderr){
        console.log("UUID: " + uuid)
        db.get(uuid, function(err, data){
          data.inprogress = false

          if(err){
            data.error = err
          }else{
            data.downloaded = true
          }
          
          db.set(uuid, data)
        })
      })
    }

    res.send({ id: uuid })
  } catch (err){
    res.status(400).send(err)
  }
})

app.get("/api/:itemId/status", (req, res) => {
  //validate param
  db.get(req.params.itemId, function(err, data){
    console.log(data)

    if(typeof data === "undefined"){
      res.status(400).send("err")
    }else{
      res.send({ uuid: data.uuid, downloaded: data.downloaded, inprogress: data.inprogress, error: data.error })
    }
  })
})

app.get("/api/:itemId/download", (req, res) => {
  const uuid = req.params.itemId

  db.get(uuid, function(err, data){
    if(err) throw err

    if(data.inprogress == true){
      res.send({"error": "downloading"})
      return
    }

    let filename
    fs.readdirSync(`./data/${uuid}/`).some((file, index) => {
      console.log(file)

      if(file.endsWith(".mp3")){
        filename = file

        return true
      }else{
        return false
      }
    });

    if(filename){
      res.download(`./data/${uuid}/${filename}`)
    }else{
      res.send({"error": "rip no file"})
    }
  })
})

app.listen(PORT, HOST, () => {
  console.log(`Running on http://${HOST}:${PORT}`);
})

function processUrl(url){
  if(typeof url === "undefined")
    throw new Error("undefined")

  const sanitizedUrl = new URL(sanitizeUrl(url))

  const allowedHostnames = ["youtube.com", "youtu.be"]
  const okUrl = allowedHostnames.some(allowedHostname => {
    return sanitizedUrl.hostname.endsWith(allowedHostname)
  })

  if(!okUrl)
    throw new Error("wrong hostname")

  return sanitizedUrl
}

function getUuid(sanitizedUrl){
  if(sanitizedUrl.hostname.includes("youtu.be"))
    return sanitizedUrl.pathname.substring(1)

  if(sanitizedUrl.hostname.includes("youtube.com"))
    return sanitizedUrl.searchParams.get("v")

  throw new Error("should not happen")
}

function generateEntry(uuid, url){
  return {
    uuid: uuid ? uuid : "",
    url: url ? url : "",
    downloaded: false,
    inprogress: false,
    error: null
  }
}

function verifyAccess(req, res, next) {
  const authCookie = req.cookies.auth

  if(typeof authCookie === "undefined")
    throw new AuthError("unauthorized 1")

  if(COOKIE !== authCookie)
    throw new AuthError("unauthorized 2")

  next()
}

function errorHandler(err, req, res, next) {
  if(err instanceof AuthError)
    res.status(401)
  else
    res.status(400)

  res.send(err.message)
}

class AuthError extends Error {
  constructor(message){
    super(message)
  }
}

cron.schedule('0 0 0 1 * *', () => {
  fs.readdirSync(`./data/`, { withFileTypes: true }).forEach((file, index) => {
    if(file.isDirectory()){
      const filename = file.name

      fs.rmSync(`./data/${filename}`, { recursive: true, force: true })
      db.remove('filename')
    }
  })
})