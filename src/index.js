const express = require("express");
const http = require("http");
const path = require("path");
const socketio = require("socket.io");
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");
const {
  getUser,
  deleteUser,
  addUser,
  getUsersInRoom,
  removeUser,
} = require("./utils/user");

const port = process.env.PORT;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
  socket.on("sendMessage", (message, callback) => {
    const user = getUser(socket.id);

    const filter = new Filter();
    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed!");
    }
    io.to(user.room).emit("message", generateMessage(user.username, message));
    callback("Delivered!");
  });

  socket.on("sendLocation", (msg, callback) => {
    const user = getUser(socket.id);
    socket
      .to(user.room)
      .emit("locationMessage", generateLocationMessage(user.username, msg));
    callback();
  });

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit("message", generateMessage(user.username, "Welcome!"));
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage(user.username, `${user.username} has joined!`)
      );
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });
    callback();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage(`${user.username} has left!`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
