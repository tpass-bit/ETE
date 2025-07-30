// Firebase Configuration (separate file: firebase-config.js)
// const firebaseConfig = {
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_AUTH_DOMAIN",
//     projectId: "YOUR_PROJECT_ID",
//     storageBucket: "YOUR_STORAGE_BUCKET",
//     messagingSenderId: "YOUR_SENDER_ID",
//     appId: "YOUR_APP_ID"
// };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const userListScreen = document.getElementById('user-list-screen');
const chatScreen = document.getElementById('chat-screen');
const callScreen = document.getElementById('call-screen');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleAuthBtn = document.getElementById('google-auth-btn');
const logoutBtn = document.getElementById('logout-btn');
const logoutBtnList = document.getElementById('logout-btn-list');
const backBtn = document.getElementById('back-btn');
const backToAuthBtn = document.getElementById('back-to-auth-btn');
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const attachBtn = document.getElementById('attach-btn');
const usersList = document.getElementById('users-list');
const userSearch = document.getElementById('user-search');
const currentUsernameList = document.getElementById('current-username-list');
const currentUserAvatarList = document.getElementById('current-user-avatar-list');

// Global Variables
let currentUser = null;
let selectedUser = null;
let localStream = null;
let peerConnection = null;
let callDocRef = null;
let isMuted = false;
let isVideoOff = false;
let currentCamera = 'user'; // 'user' or 'environment'

// Initialize the app
init();

function init() {
    // Event Listeners
    loginBtn.addEventListener('click', loginWithEmail);
    signupBtn.addEventListener('click', signUpWithEmail);
    googleAuthBtn.addEventListener('click', loginWithGoogle);
    logoutBtn.addEventListener('click', logout);
    logoutBtnList.addEventListener('click', logout);
    backBtn.addEventListener('click', goBack);
    backToAuthBtn.addEventListener('click', goBackToAuth);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    voiceCallBtn.addEventListener('click', () => initiateCall('audio'));
    videoCallBtn.addEventListener('click', () => initiateCall('video'));
    attachBtn.addEventListener('click', () => attachmentsModal.classList.remove('hidden'));
    closeModal.addEventListener('click', () => attachmentsModal.classList.add('hidden'));
    sendImageBtn.addEventListener('click', () => sendAttachment('image'));
    sendVideoBtn.addEventListener('click', () => sendAttachment('video'));
    sendDocumentBtn.addEventListener('click', () => sendAttachment('document'));
    endCallBtn.addEventListener('click', endCall);
    muteBtn.addEventListener('click', toggleMute);
    videoOffBtn.addEventListener('click', toggleVideo);
    switchCameraBtn.addEventListener('click', switchCamera);
    
    // User search functionality
    userSearch.addEventListener('input', searchUsers);
    
    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            currentUser = user;
            currentUsername.textContent = user.displayName || user.email.split('@')[0];
            currentUsernameList.textContent = user.displayName || user.email.split('@')[0];
            currentUserAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
            currentUserAvatarList.src = user.photoURL || 'https://via.placeholder.com/40';
            
            authScreen.classList.add('hidden');
            userListScreen.classList.remove('hidden');
            
            // Load users
            loadUsers();
            
            // Update user status
            updateUserStatus(true);
            
            // Listen for status changes
            window.addEventListener('beforeunload', () => {
                updateUserStatus(false);
            });
        } else {
            // User is signed out
            currentUser = null;
            selectedUser = null;
            userListScreen.classList.add('hidden');
            chatScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
        }
    });
}

// Authentication Functions
function loginWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            alert(error.message);
        });
}

function signUpWithEmail() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            // Update user profile
            const user = auth.currentUser;
            return user.updateProfile({
                displayName: email.split('@')[0],
                photoURL: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=random`
            });
        })
        .catch(error => {
            alert(error.message);
        });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            alert(error.message);
        });
}

function logout() {
    updateUserStatus(false)
        .then(() => {
            return auth.signOut();
        })
        .then(() => {
            if (peerConnection) {
                endCall();
            }
        })
        .catch(error => {
            alert(error.message);
        });
}

// User Status Functions
function updateUserStatus(isOnline) {
    if (!currentUser) return Promise.resolve();
    
    return db.collection('users').doc(currentUser.uid).set({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        photoURL: currentUser.photoURL || 'https://via.placeholder.com/40',
        status: isOnline ? 'online' : 'offline',
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// User List Functions
function loadUsers() {
    db.collection('users')
        .where('uid', '!=', currentUser.uid)
        .onSnapshot(snapshot => {
            usersList.innerHTML = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                displayUser(user);
            });
        });
}

function displayUser(user) {
    const userItem = document.createElement('div');
    userItem.classList.add('user-item');
    userItem.dataset.uid = user.uid;
    
    userItem.innerHTML = `
        <img src="${user.photoURL}" alt="${user.displayName}" class="user-avatar">
        <div class="user-name">${user.displayName}</div>
        <div class="user-status ${user.status === 'online' ? 'online' : ''}"></div>
    `;
    
    userItem.addEventListener('click', () => {
        selectedUser = user;
        currentUsername.textContent = user.displayName;
        userListScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        loadMessages();
    });
    
    usersList.appendChild(userItem);
}

function searchUsers() {
    const searchTerm = userSearch.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.querySelector('.user-name').textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Chat Functions
function loadMessages() {
    if (!selectedUser) return;
    
    // Create a combined ID for the chat
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');
    
    db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snapshot => {
            messagesContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const message = doc.data();
                displayMessage(message);
            });
            scrollToBottom();
        });
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    const isCurrentUser = message.senderId === currentUser.uid;
    messageDiv.classList.add(isCurrentUser ? 'sent' : 'received');
    
    let content = message.text;
    if (message.imageUrl) {
        content = `<img src="${message.imageUrl}" alt="Sent image" style="max-width: 100%; border-radius: 8px; margin-bottom: 5px;">`;
    } else if (message.videoUrl) {
        content = `<video src="${message.videoUrl}" controls style="max-width: 100%; border-radius: 8px; margin-bottom: 5px;"></video>`;
    } else if (message.fileUrl) {
        content = `<a href="${message.fileUrl}" target="_blank" style="color: ${isCurrentUser ? 'white' : 'var(--primary-color)'}">Download File</a>`;
    }
    
    const time = new Date(message.timestamp?.toDate() || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div>${content}</div>
        <span class="message-time">${time}</span>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !attachment) return;
    if (!selectedUser) return;
    
    // Create a combined ID for the chat
    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');
    
    const message = {
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email.split('@')[0],
        receiverId: selectedUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('chats').doc(chatId)
        .collection('messages').add(message)
        .then(() => {
            messageInput.value = '';
        })
        .catch(error => {
            alert(error.message);
        });
}

function sendAttachment(type) {
    const input = document.createElement('input');
    input.type = 'file';
    
    if (type === 'image') {
        input.accept = 'image/*';
    } else if (type === 'video') {
        input.accept = 'video/*';
    } else {
        input.accept = '*';
    }
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        if (!selectedUser) return;
        
        const storageRef = storage.ref(`attachments/${currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);
        
        uploadTask.on('state_changed', 
            null, 
            error => {
                alert(error.message);
            }, 
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                    // Create a combined ID for the chat
                    const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');
                    
                    const message = {
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || currentUser.email.split('@')[0],
                        receiverId: selectedUser.uid,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (type === 'image') {
                        message.imageUrl = downloadURL;
                        message.text = 'Sent an image';
                    } else if (type === 'video') {
                        message.videoUrl = downloadURL;
                        message.text = 'Sent a video';
                    } else {
                        message.fileUrl = downloadURL;
                        message.text = `Sent a file: ${file.name}`;
                    }
                    
                    db.collection('chats').doc(chatId)
                        .collection('messages').add(message);
                    
                    attachmentsModal.classList.add('hidden');
                });
            }
        );
    };
    
    input.click();
}

// Call Functions
async function initiateCall(type) {
    if (!selectedUser) {
        alert('Please select a user to call');
        return;
    }
    
    try {
        // Create a call document in Firestore
        callDocRef = db.collection('calls').doc();
        
        // Get local media stream
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === 'video'
        });
        
        // Display local video
        if (type === 'video') {
            localVideo.srcObject = localStream;
        }
        
        // Create peer connection
        createPeerConnection();
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Set up caller info
        callerName.textContent = selectedUser.displayName;
        callStatus.textContent = 'Calling...';
        callerAvatar.src = selectedUser.photoURL || 'https://via.placeholder.com/80';
        
        // Show call screen
        chatScreen.classList.add('hidden');
        callScreen.classList.remove('hidden');
        
        // Create offer
        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);
        
        // Save call data
        const callData = {
            offer: {
                type: offerDescription.type,
                sdp: offerDescription.sdp
            },
            callerId: currentUser.uid,
            callerName: currentUser.displayName || currentUser.email.split('@')[0],
            callerAvatar: currentUser.photoURL,
            calleeId: selectedUser.uid,
            calleeName: selectedUser.displayName,
            calleeAvatar: selectedUser.photoURL,
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await callDocRef.set(callData);
        
        // Listen for answer
        callDocRef.collection('calleeCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    peerConnection.addIceCandidate(candidate);
                }
            });
        });
        
        callDocRef.onSnapshot(async snapshot => {
            const data = snapshot.data();
            if (!data.answer) return;
            
            if (!peerConnection.currentRemoteDescription) {
                const answerDescription = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answerDescription);
            }
        });
        
    } catch (error) {
        console.error('Error initiating call:', error);
        alert('Error starting call: ' + error.message);
        endCall();
    }
}

function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // You can add more STUN/TURN servers here if needed
        ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Listen for ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            callDocRef.collection('callerCandidates').add(event.candidate.toJSON());
        }
    };
    
    // Listen for remote stream
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
        callStatus.textContent = 'Connected';
    };
    
    // Listen for connection state changes
    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed') {
            endCall();
        }
    };
}

function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
    
    muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    muteBtn.style.backgroundColor = isMuted ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
}

function toggleVideo() {
    if (!localStream) return;
    
    isVideoOff = !isVideoOff;
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOff;
    });
    
    videoOffBtn.innerHTML = isVideoOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
    videoOffBtn.style.backgroundColor = isVideoOff ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
    
    if (isVideoOff) {
        localVideo.style.display = 'none';
    } else {
        localVideo.style.display = 'block';
    }
}

async function switchCamera() {
    if (!localStream || isVideoOff) return;
    
    try {
        currentCamera = currentCamera === 'user' ? 'environment' : 'user';
        
        // Stop current video tracks
        localStream.getVideoTracks().forEach(track => track.stop());
        
        // Get new stream with the other camera
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentCamera }
        });
        
        // Replace the video track
        const videoTrack = newStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        await sender.replaceTrack(videoTrack);
        
        // Update local video display
        localStream.getVideoTracks()[0].stop();
        localStream.removeTrack(localStream.getVideoTracks()[0]);
        localStream.addTrack(videoTrack);
        localVideo.srcObject = null;
        localVideo.srcObject = localStream;
        
        // Close the unused stream
        newStream.getAudioTracks().forEach(track => track.stop());
    } catch (error) {
        console.error('Error switching camera:', error);
    }
}

async function endCall() {
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clean up Firestore data
    if (callDocRef) {
        // Delete caller candidates
        const callerCandidates = await callDocRef.collection('callerCandidates').get();
        callerCandidates.forEach(candidate => candidate.ref.delete());
        
        // Delete call document
        callDocRef.delete();
        callDocRef = null;
    }
    
    // Hide call screen
    callScreen.classList.add('hidden');
      
