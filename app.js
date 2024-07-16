const path = require('path')
const {createServer} = require('http')
const express = require('express')
const {Server} = require('socket.io')

const fs = require('fs')

const app = express()
const server = createServer(app)
const io = new Server(server)

let rooms=[]


app.use(express.static("files"))

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,"index.html"))
})

server.listen(10000,_=>{
    console.log("listening at port 10000")
})

io.on('connection',(socket)=>{

    socket.on("joinRoom",(roomId,name)=>{
        try{
            if(roomId.length<8) throw new Error("Room length must be 8 character can be alphabets and numbers")

        }catch(err){
            io.to(socket.id).emit("error",err.message)
            return
        }
        const sid = socket.id
        socket.join(roomId)
        
        io.to(roomId).emit("userJoined",name)

        io.to(sid).emit("existingUsers",rooms.map(i=>i.name))

        rooms.push({roomId,name,sid})    

        socket.on('message',(msg,id,userName)=>{
            io.to(roomId).emit('message',msg,id,userName)
        })
    })

    socket.on("leaveRoom",(user,roomId)=>{
        
        rooms=rooms.map(i=>{
            if(i.name===user && i.roomId===roomId && i.sid===socket.id) return undefined
            else{
                return i
            }
        })

        rooms=rooms.filter(i=>i!==undefined)

        socket.disconnect()
        socket.leave(roomId)

        if(rooms.length===0){
            fs.readdir(path.join(__dirname,"files"),(err,files)=>{
                if(files && files.length!==0){
                for(const file of files){
                    fs.unlink(path.join(__dirname,"files",file),(err)=>{
                        // console.log(err)
                    })
                }
            }
            })
        }

        io.to(roomId).emit("userLeft",user)

    })

    socket.on('fileSent',(file,roomId,userId,userName)=>{
        
        try{
            if(file.fileContent.length>2000000){
                throw new Error("file size too large")
            }

        }catch(err){
            io.to(socket.id).emit("error",err.message)
            return
        }

        if (!fs.existsSync("files")){
            fs.mkdirSync("files")
            app.use(express.static("files"))

        }

        fs.writeFile(path.join(__dirname,"files",file.fileName),Buffer.from(file.fileContent),err=>{
            // console.log(err)
        })

        const fileData ={
            Name:file.fileName,
            Type:file.fileType
        }

        io.to(roomId).emit("fileBroadcast",fileData,userId,userName)

    })

    socket.on("disconnecting",(reason)=>{

        if(reason!=="transport error") return

        let userName
        rooms=rooms.map(i=>{
            if(i.sid===socket.id) {
                userName=i.name
                return undefined
            }
            else{
                return i
            }
        })

        rooms=rooms.filter(i=>i!==undefined)

        if(rooms.length===0){
            fs.readdir(path.join(__dirname,"files"),(err,files)=>{
                if(files && files.length!==0){
                for(const file of files){
                    fs.unlink(path.join(__dirname,"files",file),(err)=>{
                        // console.log(err)
                    })
                }
            }
            })
        }


        for(const room of socket.rooms){
            if(room!==socket.id){
                io.to(room).emit("abruptDisconnection",userName+" was disconnected abruptly")

            }
        }
    })



})