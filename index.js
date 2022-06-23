import { Server } from "socket.io";
import express from "express";
import http from "http";
import path from "path";

//const
const PORT = 3000;

//var
const users = {
  someID: {
    id: "someID",
    name: "someone",
  },
};
const rooms = {
  roomCode: {
    code: "roomCode",
    createdAt: new Date(),
    createdBy: "someID",
    messages: [
      { senderId: "someID", content: "yo hi", createdAt: new Date() },
      { senderId: "someID", content: "second msg", createdAt: new Date() - 1 },
    ],
  },
};

//class
class User {
  constructor(id, loginString, name) {
    this.id = id;
    this.loginString = loginString;
    this.name = name;
  }
}

class Room {
  constructor(code, user) {
    this.code = code;
    this.createdAt = new Date();
    this.ownerId = user.id;
    this.messages = [];
    // this.messages = [
    //   { senderId: "someID", content: "yo hi", createdAt: new Date() },
    //   { senderId: "someID", content: "second msg", createdAt: new Date() - 1 },
    // ];
  }
}

class Message {
  constructor(content, user) {
    this.senderId = user.id;
    this.senderName = user.name;
    this.content = content;
    this.createdAt = new Date();
  }
}

//emit
const emitErr = (socket, msg) => {
  socket.emit("err", msg);
};

const emitMsg = (socket, msg) => {
  socket.emit("msg", msg);
};

const emitUserData = (socket, userLoginString) => {
  socket.emit("userData", users[userLoginString]);
};

const emitRoomData = (socket, roomCode) => {
  socket.emit("roomData", rooms[roomCode]);
};

const emitMessageData = (socket, message) => {
  socket.emit("messageData", message);
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.sendFile(path.resolve() + "/index.html");
});

io.on("connection", (socket) => {
  //sign-in or sign-up
  socket.on("login", (loginString) => {
    loginString = String(loginString).trim();
    if (loginString !== "") {
      let user = users[loginString];
      if (user === undefined) {
        user = new User(socket.id, loginString, loginString);
        users[loginString] = user;
      }
      socket.userData = user;
      emitUserData(socket, user.loginString);
    } else {
      emitErr(socket, "login string cannot be empty");
    }
  });

  //rename
  socket.on("name", (name) => {
    name = String(name).trim();
    if (name !== "") {
      let updatedUser = users[socket.userData.loginString];
      updatedUser.name = name;

      users[socket.userData.loginString] = updatedUser;
      socket.userData = updatedUser;
      emitUserData(socket, updatedUser.loginString);
    } else {
      emitErr(socket, "name cannot be empty");
    }
  });

  //enter or create room
  socket.on("room", (roomCode) => {
    roomCode = String(roomCode).trim();
    if (roomCode !== "") {
      if (socket?.currentRoomCode !== undefined) {
        socket.leave(socket.currentRoomCode);
        emitMsg(socket, `you left room ${socket.currentRoomCode}`);
      }
      let room = rooms[roomCode];
      if (room === undefined) {
        room = new Room(roomCode, socket.userData);
        room.messages.push(
          new Message(
            `"${users[socket.userData.loginString].name}" created this room "${
              room.code
            }"`,
            new User("admin", "admin", "admin")
          )
        );
        rooms[roomCode] = room;
        emitMsg(socket, `you created room "${roomCode}"`);
      }
      socket.join(roomCode);
      socket.currentRoomCode = roomCode;
      emitMsg(socket, `you joined room "${roomCode}"`);
      emitMsg(
        socket.broadcast,
        `"${users[socket.userData.loginString].name}" joined the room`
      );
      emitRoomData(socket, roomCode);
    } else {
      emitErr(socket, "room code cannot be empty");
    }
  });

  //send message to room
  socket.on("message", (content) => {
    if (socket?.currentRoomCode !== undefined) {
      let message = new Message(content, users[socket.userData.loginString]);
      rooms[socket.currentRoomCode].messages.push(message);
      emitMessageData(io.to(socket.currentRoomCode), message);
    } else {
      emitErr(socket, "you cannot send message outside before enter room");
    }
  });
});

server.listen(process.env.PORT || PORT);
