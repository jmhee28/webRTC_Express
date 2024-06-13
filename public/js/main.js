const turnConfig = {
    iceServers: [
        {
            urls: 'stun:stun1.l.google.com:19302',
        },
        {
            urls: 'stun:stun3.l.google.com:19302',
        },
        {
            urls: 'stun:stun4.l.google.com:19302',
        },
    ],
};
const socket = io();
const peers = {};
const fileInput = document.getElementById('fileInput');
const roomForm = document.getElementById('roomForm');
const roomInput = document.getElementById('roomInput');
const messagesDiv = document.getElementById('messages');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

roomForm.addEventListener('submit', event => {
    event.preventDefault();
    const roomName = roomInput.value;
    socket.emit('join-room', roomName);
    roomForm.style.display = 'none';
    fileInput.style.display = 'block';
    leaveRoomBtn.style.display = 'block';
    addMessage(`Joined room: ${roomName}`);
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    sendFile(file);
    addMessage(`Sending file: ${file.name}`);
});

leaveRoomBtn.addEventListener('click', () => {
    const roomName = roomInput.value;
    socket.disconnect(); // Disconnect from Socket.IO server
    roomForm.style.display = 'block';
    fileInput.style.display = 'none';
    leaveRoomBtn.style.display = 'none';
    messagesDiv.innerHTML = ''; // Clear messages when leaving room
    addMessage(`Left room: ${roomName}`);
});
function sendFile(file) {
    const chunkSize = 16384;
    const reader = new FileReader();
    let offset = 0;

    reader.onload = e => {
        const chunk = e.target.result;
        for (const userId in peers) {
            if (peers[userId].dataChannel && peers[userId].dataChannel.readyState === 'open') {
                peers[userId].dataChannel.send(chunk);
            }
        }
        offset += chunkSize;
        if (offset < file.size) {
            readSlice(offset);
        } else {
            addMessage(`File sent: ${file.name}`);
        }
    };

    const readSlice = o => {
        const slice = file.slice(offset, o + chunkSize);
        reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
}

socket.on('user-connected', userId => {
    addMessage(`User connected: ${userId}`);
    createPeerConnection(userId, true);
});

socket.on('offer', (userId, offer) => {
    addMessage(`Received offer from: ${userId}`);
    createPeerConnection(userId, false);
    peers[userId].peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peers[userId].peerConnection.createAnswer())
        .then(answer => peers[userId].peerConnection.setLocalDescription(answer))
        .then(() => socket.emit('answer', userId, peers[userId].peerConnection.localDescription));
});

socket.on('answer', (userId, answer) => {
    addMessage(`Received answer from: ${userId}`);
    peers[userId].peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', (userId, candidate) => {
    addMessage(`Received candidate from: ${userId}`);
    peers[userId].peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('user-disconnected', userId => {
    addMessage(`User disconnected: ${userId}`);
    if (peers[userId]) {
        peers[userId].peerConnection.close();
        delete peers[userId];
    }
});

function createPeerConnection(userId, isInitiator) {
    if (peers[userId]) return; // 이미 연결된 경우 무시

    const peerConnection = new RTCPeerConnection(turnConfig);
    peers[userId] = { peerConnection };

    if (isInitiator) {
        const dataChannel = peerConnection.createDataChannel('fileTransfer');
        peers[userId].dataChannel = dataChannel;
        setupDataChannel(dataChannel, userId);
    } else {
        peerConnection.ondatachannel = event => {
            const dataChannel = event.channel;
            peers[userId].dataChannel = dataChannel;
            setupDataChannel(dataChannel, userId);
        };
    }

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', userId, event.candidate);
        }
    };

    if (isInitiator) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => socket.emit('offer', userId, peerConnection.localDescription));
    }
}

function setupDataChannel(dataChannel, userId) {
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = () => addMessage(`Data channel opened for user: ${userId}`);
    dataChannel.onclose = () => addMessage(`Data channel closed for user: ${userId}`);
    dataChannel.onmessage = event => receiveFile(event.data, userId);
}

function receiveFile(data, userId) {
    const fileBlob = new Blob([data]);
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(fileBlob);
    link.download = `received_file_from_${userId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addMessage(`File received from: ${userId}`);
}