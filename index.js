const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)

const redis = require('socket.io-redis')
io.adapter(redis())

const mongoose = require('mongoose')
mongoose.Promise = global.Promise

const port = process.env.PORT || 3333

const bodyParser = require('body-parser')
const session = require('express-session')
const sharedSession = require('express-socket.io-session')

const jwt = require('jsonwebtoken')
const jwtSecret = 'projetochat'
const Room = require('./models/room')
const Message = require('./models/message')
const Admin = require('./models/admin')
const User = require('./models/user')
const cors = require('cors')
app.use(express.static('public'))
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

const expressSession = session({
  secret: 'socketio',
  cookie: {
    maxAge: 10*60*1000
  }
})
app.use(cors())
app.use(expressSession)
io.use(sharedSession(expressSession, { autoSave: true }))
io.use(async(socket, next) => {
  const isValid = await jwt.verify(socket.handshake.query.token, jwtSecret)
  if(!socket.handshake.query.token || !isValid ){
    next(new Error('Auth failed.'))
  }else{
    next()
  }

})

app.set('view engine', 'ejs')

app.get('/',  (req, res) => res.render('home'))
app.post('/auth',async (req, res) => {

  const token = await jwt.sign({
    data:{name: req.body.name},
  },jwtSecret)
 
  res.send({
    token
  })
})
app.post('/admin', async(req,res)=>{
  const user = await Admin.findOne({username: req.body.username})
  const isValid = await user.checkPassword(req.body.password)
  const payload = {
    id: user._id,
    username: user.username,
    roles: user.roles
  }
  jwt.sign(payload, jwtSecret,(err, token)=>{
    res.send({
      success: true,
      token: token
    })
  })
    if(isValid){
      req.session.user = user
      
    }else{
      res.send({success:false, message:'Usuário ou senha inválidos'})
    }

  
})
app.get('/room', (req, res) => {
  if(!req.session.user){
    res.redirect('/')
  }else{
    res.render('room', {
      name: req.session.user.name
    })
  }
})
app.post('/user', async(req,res) =>{
  const user = new User(req.body)
  await user.save()
  res.send(user)
})

app.get('/user', async(req,res)=>{
  const nomes = await User.find({})
  res.send(nomes)
} )

io.on('connection', socket => {
  console.log('connected', socket.id)
  // salas iniciais
  Room.find({}, (err, rooms) =>{
    socket.emit('roomList', rooms)
  })
  // addRoom
  socket.on('addRoom', roomName => {
    const room = new Room({
      name: roomName
    })
    room
      .save()
      .then(() => {
        io.emit('newRoom', room)
      })
  })
  // join na sala
  socket.on('join', roomId => {
    socket.join(roomId)
    Message
      .find({ room: roomId})
      .then( msgs => {
        socket.emit('msgsList', msgs)
      })
  })
  socket.on('sendMsg', async msg => {
    const decoded = await jwt.decode(socket.handshake.query.token, jwtSecret)
    const message = new Message({
      author: decoded.data.name,
      when: new Date(),
      msgType: 'text',
      message: msg.msg,
      room: msg.room
    })
    message
      .save()
      .then(()=>{
        io.to(msg.room).emit('newMsg', message)
      })
  })
  socket.on('sendAudio', async msg => {
    const decoded = await jwt.decode(socket.handshake.query.token, jwtSecret)
    const message = new Message({
      author: decoded.data.name,
      when: new Date(),
      msgType: 'audio',
      message: msg.data,
      room: msg.room
    })
    message
      .save()
      .then(()=>{
        io.to(msg.room).emit('newAudio', message)
      })
  })
})
const createInitialUsers = async() => {
  const total = await Admin.count({})
  if(total === 0 ){
      const admin = new Admin({
          username: 'admin',
          password: 'abc123',
          roles: 'admin'
      })
      await admin.save()
  }
}

mongoose
  .connect('mongodb://localhost:27017/batepapo-rest', { useMongoClient: true })
  .then(() => {
    createInitialUsers()
    http.listen(port, () => {
      console.log('Chat running... ', port)
    })
  })
