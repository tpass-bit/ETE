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
const chatScreen = document.getElementById('chat-screen');
const callScreen = document.getElementById('call-screen');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleAuthBtn = document.getElementById('google-auth-btn');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const attachBtn = document.getElementById('attach-btn');
const attachmentsModal = document.getElementById('attachments-modal');
const closeModal = document.querySelector('.close-modal');
const sendImageBtn = document.getElementById('send-image-btn');
const sendVideoBtn = document.getElementById('send-video-btn');
const sendDocumentBtn = document.getElementById('send-document-btn');
const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const videoOffBtn = document.getElementById('video-off-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const callerName = document.getElementById('caller-name');
const callStatus = document.getElementById('call-status');
const callerAvatar = document.getElementById('caller-avatar');
const currentUsername = document.getElementById('current-username');
const currentUserAvatar = document.getElementById('current-user-avatar');

// Global Variables
let currentUser = null;
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
    backBtn.addEventListener('click', goBack);
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
    
    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            currentUser = user;
            currentUsername.textContent = user.displayName || user.email.split('@')[0];
            currentUserAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
            
            authScreen.classList.add('hidden');
            chatScreen.classList.remove('hidden');
            
            // Load messages
            loadMessages();
        } else {
            // User is signed out
            currentUser = null;
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
    auth.signOut()
        .then(() => {
            if (peerConnection) {
                endCall();
            }
        })
        .catch(error => {
            alert(error.message);
        });
}

// Chat Functions
function loadMessages() {
    db.collection('messages')
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
    
    const message = {
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email.split('@')[0],
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('messages').add(message)
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
        
        const storageRef = storage.ref(`attachments/${currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);
        
        uploadTask.on('state_changed', 
            null, 
            error => {
                alert(error.message);
            }, 
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then(downloadURL => {
                    const message = {
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || currentUser.email.split('@')[0],
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
                    
                    db.collection('messages').add(message);
                    attachmentsModal.classList.add('hidden');
                });
            }
        );
    };
    
    input.click();
}

// Call Functions
async function initiateCall(type) {
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
        callerName.textContent = 'Calling...';
        callStatus.textContent = 'Starting call...';
        callerAvatar.src = currentUser.photoURL || 'https://via.placeholder.com/80';
        
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
    chatScreen.classList.remove('hidden');
}

// Helper Functions
function goBack() {
    if (callScreen.classList.contains('hidden')) {
        // If not in a call, go back to auth screen (logout)
        logout();
    } else {
        // If in a call, end the call
        endCall();
    }
}

// Listen for incoming calls
db.collection('calls').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
        if (change.type === 'added' && change.doc.id !== callDocRef?.id) {
            // This is an incoming call
            const callData = change.doc.data();
            
            if (callData.callerId === currentUser.uid) return; // Ignore our own calls
            
            // Show call screen
            callerName.textContent = callData.callerName;
            callStatus.textContent = `Incoming ${callData.type} call`;
            callerAvatar.src = callData.callerAvatar || 'https://via.placeholder.com/80';
            
            chatScreen.classList.add('hidden');
            callScreen.classList.remove('hidden');
            
            // Create peer connection
            createPeerConnection();
            
            // Set remote description
            const offerDescription = new RTCSessionDescription(callData.offer);
            await peerConnection.setRemoteDescription(offerDescription);
            
            // Create answer
            const answerDescription = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answerDescription);
            
            // Get local media stream
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: callData.type === 'video'
            });
            
            // Display local video
            if (callData.type === 'video') {
                localVideo.srcObject = localStream;
            }
            
            // Add local stream to peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Save answer to Firestore
            const answer = {
                type: answerDescription.type,
                sdp: answerDescription.sdp
            };
            
            await change.doc.ref.update({ answer });
            
            // Listen for ICE candidates from caller
            change.doc.ref.collection('callerCandidates').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate);
                    }
                });
            });
            
            // Add our ICE candidates
            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    change.doc.ref.collection('calleeCandidates').add(event.candidate.toJSON());
                }
            };
        }
    });
});
