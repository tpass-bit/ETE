// ----------------- DOM Elements -----------------
const authScreen = document.getElementById('auth-screen');
const userListScreen = document.getElementById('user-list-screen');
const chatScreen = document.getElementById('chat-screen');
const callScreen = document.getElementById('call-screen');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleAuthBtn = document.getElementById('google-auth-btn');
const logoutBtn = document.getElementById('logout-btn');
const logoutBtnList = document.getElementById('logout-btn-list');

const backToAuthBtn = document.getElementById('back-to-auth-btn');
const backBtn = document.getElementById('back-btn');

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');

// User info
const currentUsername = document.getElementById('current-username');
const currentUserAvatar = document.getElementById('current-user-avatar');
const currentUsernameList = document.getElementById('current-username-list');
const currentUserAvatarList = document.getElementById('current-user-avatar-list');

// Attachments
const attachmentsModal = document.getElementById('attachments-modal');
const closeModal = document.querySelector('#attachments-modal .close-modal');
const sendImageBtn = document.getElementById('send-image-btn');
const sendVideoBtn = document.getElementById('send-video-btn');
const sendDocumentBtn = document.getElementById('send-document-btn');
const attachBtn = document.getElementById('attach-btn');

// Call
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const callerName = document.getElementById('caller-name');
const callerAvatar = document.getElementById('caller-avatar');
const callStatus = document.getElementById('call-status');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const videoOffBtn = document.getElementById('video-off-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');

// ----------------- Firebase Setup -----------------
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;

// ----------------- Helpers -----------------
function showScreen(screen) {
    [authScreen, userListScreen, chatScreen, callScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function showError(message) {
    const err = document.createElement('div');
    err.textContent = message;
    err.className = "error-toast";
    document.body.appendChild(err);
    setTimeout(() => err.remove(), 3000);
}

// ----------------- Auth Events -----------------
loginBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) return showError("Enter email & password");

    auth.signInWithEmailAndPassword(email, password)
        .then(userCred => {
            currentUser = userCred.user;
            updateUserUI();
            showScreen(userListScreen);
        })
        .catch(err => showError(err.message));
});

signupBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) return showError("Enter email & password");

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCred => {
            currentUser = userCred.user;
            updateUserProfile();
            updateUserUI();
            showScreen(userListScreen);
        })
        .catch(err => showError(err.message));
});

googleAuthBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            currentUser = result.user;
            updateUserProfile();
            updateUserUI();
            showScreen(userListScreen);
        })
        .catch(err => showError(err.message));
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => showScreen(authScreen));
});
logoutBtnList.addEventListener('click', () => {
    auth.signOut().then(() => showScreen(authScreen));
});

backToAuthBtn.addEventListener('click', () => showScreen(authScreen));
backBtn.addEventListener('click', () => showScreen(userListScreen));

// ----------------- Update UI -----------------
function updateUserUI() {
    if (!currentUser) return;
    const name = currentUser.displayName || currentUser.email.split('@')[0];
    const photo = currentUser.photoURL || "https://via.placeholder.com/40";

    currentUsername.textContent = name;
    currentUserAvatar.src = photo;
    currentUsernameList.textContent = name;
    currentUserAvatarList.src = photo;
}

function updateUserProfile() {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).set({
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        photoURL: currentUser.photoURL || "https://via.placeholder.com/40",
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// ----------------- Chat -----------------
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;

    db.collection("messages").add({
        text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email.split('@')[0],
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    messageInput.value = "";
}

db.collection("messages").orderBy("timestamp").onSnapshot(snapshot => {
    messagesContainer.innerHTML = "";
    snapshot.forEach(doc => {
        const msg = doc.data();
        const msgEl = document.createElement("div");
        msgEl.classList.add("message", msg.senderId === (currentUser && currentUser.uid) ? "sent" : "received");
        msgEl.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.text}`;
        messagesContainer.appendChild(msgEl);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// ----------------- Attachments -----------------
attachBtn.addEventListener('click', () => attachmentsModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => attachmentsModal.classList.add('hidden'));

sendImageBtn.addEventListener('click', () => alert("Image upload coming soon!"));
sendVideoBtn.addEventListener('click', () => alert("Video upload coming soon!"));
sendDocumentBtn.addEventListener('click', () => alert("Document upload coming soon!"));

// ----------------- Calls -----------------
endCallBtn.addEventListener('click', () => {
    callStatus.textContent = "Call ended";
    showScreen(chatScreen);
});
muteBtn.addEventListener('click', () => muteBtn.classList.toggle('active'));
videoOffBtn.addEventListener('click', () => videoOffBtn.classList.toggle('active'));
switchCameraBtn.addEventListener('click', () => alert("Switch camera not implemented"));

// ----------------- Auto Login -----------------
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        updateUserUI();
        showScreen(userListScreen);
    } else {
        showScreen(authScreen);
    }
});
