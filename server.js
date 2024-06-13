// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
	res.render('index');
});

io.on('connection', socket => {
	console.log('A user connected: ', socket.id);

	socket.on('join-room', room => {
		socket.join(room);
		socket.to(room).emit('user-connected', socket.id);

		socket.on('offer', (id, message) => {
			socket.to(id).emit('offer', socket.id, message);
		});

		socket.on('answer', (id, message) => {
			socket.to(id).emit('answer', socket.id, message);
		});

		socket.on('candidate', (id, message) => {
			socket.to(id).emit('candidate', socket.id, message);
		});

		socket.on('disconnect', () => {
			socket.to(room).emit('user-disconnected', socket.id);
		});
	});
});

server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
