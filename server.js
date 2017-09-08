var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mongoose = require('mongoose');
var clients = [];

var uri = "mongodb://" + process.env.PASS + "@ds033966.mlab.com:33966/szantog82";

var MessageSchema = mongoose.Schema({
    from: String,
    message: String,
    time: String
});

var Message = mongoose.model("Message", MessageSchema);

io.on('connection', function(socket) {
    var addressFull = socket.handshake.headers["x-forwarded-for"];
    var address = addressFull.split(",")[0];

    socket.on("login", function(login) {
        var pres = false;
        if (typeof(login) == "string") login = JSON.parse(login);
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].name == login.name) pres = true;
        };
        if (pres) {
            console.log("User with name: " + login.name + " already connected!");
          pres = false;
        } else {
            clients.push({
                name: login.name,
                ip: address,
                id: socket.id,
                socket: socket
            });
            console.log("Connection received from: " + address + ", name: " + login.name + ", id: " + socket.id);
            console.log("No of clients now: " + clients.length);
          var output = {
                    time: "0",
                    from: "Server",
                    message: "Welcome back " + login.name
                };
            socket.emit("fromserver", output);
            mongoose.connect(uri);
            var db = mongoose.connection.collection('Messages');
            db.find({}, function(err, data) {
                data.toArray(function(err2, data2) {
                   // console.log(data2);
                    for (var i = 0; i < data2.length; i++) {
                        if (data2[i].from != login.name) {
                            var output = {
                                time: "0",
                                from: data2[i].from,
                                message: data2[i].message
                            };
                            socket.emit("fromserver", output);
                            db.remove({
                                _id: data2[i]["_id"]
                            }, function(a, b) {});
                        }
                    }
                });
            });
        }
    });

    socket.on("fromclient", function(input) {
        if (typeof(input) == "string") input = JSON.parse(input);
        console.log("Incoming message; name: " + input.name + ", msg: " + input.message);
        var count = 0;
        for (var i = 0; i < clients.length; i++) {
            if (clients[i].name != input.name) {
                var output = {
                    from: input.name,
                    message: input.message
                };
                clients[i].socket.emit("fromserver", output);
                console.log("Message emitted to " + clients[i].name);
                count++;
            }
        }
        if (count == 0) {
            var d = new Date();
            var saveToDb = new Message();
            saveToDb.from = input.name;
            saveToDb.message = input.message;
            saveToDb.time = d.getTime().toString();
            mongoose.connect(uri);
            var db = mongoose.connection.collection('Messages');
            db.insert(saveToDb);
            console.log("Message: " + input.message + " from " + input.name + " saved to db.");
        }
    });

    socket.on("disconnect", function(res) {
        console.log("User disconnected with id: " + socket.id);
        var pos = -1;
        for (var i = 0; i < clients.length; i++) {
            if (socket.id == clients[i]["id"]) {
                pos = i;
            }
            if (pos > -1) clients.splice(pos, 1);
            console.log("No of clients left: " + clients.length);
        }
    })
});


app.get("/", function(req, res) {
    res.send("Hello");

})

var listener = http.listen(process.env.PORT, function() {
    console.log('Your app is listening on port ' + listener.address().port);
});
