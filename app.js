"use strict";

/*
    ============================================================
    CONFIGURAÇÃO
    ============================================================
*/

const PASSWORD_HASH =
    "714b6d5f3782e078caa4e33cf153892be6b3147e7c29f7811b5ee8c845415042";

const PEER_CONFIG = {
    debug: 1
};

const SESSION_KEY =
    "sefvoce-session";


/*
    ============================================================
    ESTADO
    ============================================================
*/

let currentUser = null;
let roomCode = null;
let peer = null;

let localStream = null;
let screenStream = null;

let isHost = false;
let restoringSession = false;

const connections = new Map();
const cameraCalls = new Map();
const screenCalls = new Map();

const remoteUsers = new Map();

const incomingFiles = new Map();


/*
    ============================================================
    ELEMENTOS
    ============================================================
*/

const passwordScreen =
    document.getElementById("passwordScreen");

const userScreen =
    document.getElementById("userScreen");

const roomScreen =
    document.getElementById("roomScreen");

const passwordForm =
    document.getElementById("passwordForm");

const passwordInput =
    document.getElementById("passwordInput");

const passwordError =
    document.getElementById("passwordError");

const userError =
    document.getElementById("userError");

const roomError =
    document.getElementById("roomError");

const otherUserBox =
    document.getElementById("otherUserBox");

const otherUserInput =
    document.getElementById("otherUserInput");

const otherUserConfirm =
    document.getElementById("otherUserConfirm");

const roomInput =
    document.getElementById("roomInput");

const enterRoomButton =
    document.getElementById("enterRoomButton");

const createRoomButton =
    document.getElementById("createRoomButton");

const app =
    document.getElementById("app");

const localVideo =
    document.getElementById("localVideo");

const localName =
    document.getElementById("localName");

const roomName =
    document.getElementById("roomName");

const videoGrid =
    document.getElementById("videoGrid");

const participantList =
    document.getElementById("participantList");

const participantCount =
    document.getElementById("participantCount");

const emptyCall =
    document.getElementById("emptyCall");

const messages =
    document.getElementById("messages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const fileInput =
    document.getElementById("fileInput");

const fileList =
    document.getElementById("fileList");

const micButton =
    document.getElementById("micButton");

const cameraButton =
    document.getElementById("cameraButton");

const screenButton =
    document.getElementById("screenButton");

const speakerButton =
    document.getElementById("speakerButton");

const leaveButton =
    document.getElementById("leaveButton");

const copyRoomButton =
    document.getElementById("copyRoomButton");

const statusDot =
    document.getElementById("statusDot");

const connectionStatusText =
    document.getElementById("connectionStatusText");

const toast =
    document.getElementById("toast");


/*
    ============================================================
    UTILITÁRIOS
    ============================================================
*/

function showScreen(screen) {

    document
        .querySelectorAll(".screen")
        .forEach(element => {
            element.classList.remove("active");
        });

    screen.classList.add("active");
}


function showToast(text) {

    toast.textContent = text;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}


function normalizeRoomCode(value) {

    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 30);
}


function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}


function createId() {

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}


function saveSession() {

    if (!currentUser || !roomCode) {
        return;
    }

    try {

        localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
                user: currentUser,
                room: roomCode
            })
        );

    } catch (error) {

        console.warn(
            "Não foi possível salvar a sessão:",
            error
        );
    }
}


function loadSession() {

    try {

        const raw =
            localStorage.getItem(
                SESSION_KEY
            );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);

    } catch {

        return null;
    }
}


function clearSession() {

    try {

        localStorage.removeItem(
            SESSION_KEY
        );

    } catch {}
}


/*
    ============================================================
    HASH DA SENHA
    ============================================================
*/

async function sha256(text) {

    const data =
        new TextEncoder().encode(text);

    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return Array
        .from(new Uint8Array(hash))
        .map(byte =>
            byte.toString(16).padStart(2, "0")
        )
        .join("");
}


/*
    ============================================================
    ID DA SALA
    ============================================================
*/

async function roomPeerId(room) {

    const data =
        new TextEncoder().encode(
            "sefoussefossevoce-" + room
        );

    const hash =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    const bytes =
        new Uint8Array(hash);

    let hex = "";

    for (const byte of bytes) {

        hex += byte
            .toString(16)
            .padStart(2, "0");
    }

    return "room-" + hex.slice(0, 24);
}


/*
    ============================================================
    SENHA
    ============================================================
*/

passwordForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        passwordError.textContent = "";

        const typedPassword =
            passwordInput.value;

        const hash =
            await sha256(
                typedPassword
            );

        if (hash !== PASSWORD_HASH) {

            passwordError.textContent =
                "Senha incorreta.";

            passwordInput.value = "";

            passwordInput.focus();

            return;
        }

        passwordInput.value = "";

        showScreen(userScreen);
    }
);


/*
    ============================================================
    ESCOLHA DO USUÁRIO
    ============================================================
*/

document
    .querySelectorAll(".userButton")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const user =
                    button.dataset.user;

                userError.textContent = "";

                if (user === "Outro") {

                    otherUserBox.classList.remove(
                        "hidden"
                    );

                    otherUserInput.focus();

                    return;
                }

                selectUser(user);
            }
        );
    });


otherUserConfirm.addEventListener(
    "click",
    () => {

        const name =
            otherUserInput.value.trim();

        if (!name) {

            userError.textContent =
                "Digite um nome.";

            return;
        }

        selectUser(name);
    }
);


otherUserInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            otherUserConfirm.click();
        }
    }
);


function selectUser(name) {

    if (name.length > 30) {

        userError.textContent =
            "O nome é muito grande.";

        return;
    }

    currentUser = name;

    saveSession();

    showScreen(roomScreen);

    roomInput.focus();
}


/*
    ============================================================
    SALA
    ============================================================
*/

createRoomButton.addEventListener(
    "click",
    () => {

        const code =
            generateRoomCode();

        roomInput.value = code;

        enterRoom(code);
    }
);


enterRoomButton.addEventListener(
    "click",
    () => {

        const code =
            normalizeRoomCode(
                roomInput.value
            );

        enterRoom(code);
    }
);


roomInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            enterRoomButton.click();
        }
    }
);


function generateRoomCode() {

    const characters =
        "abcdefghijkmnopqrstuvwxyz23456789";

    let result = "";

    for (let i = 0; i < 8; i++) {

        result +=
            characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];
    }

    return result;
}


async function enterRoom(code) {

    roomError.textContent = "";

    if (!code) {

        roomError.textContent =
            "Digite um código de sala.";

        return;
    }

    roomCode = code;

    saveSession();

    roomName.textContent =
        roomCode;

    localName.textContent =
        currentUser;

    app.classList.remove("hidden");

    document
        .querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.remove("active");
        });

    await startLocalMedia();

    await connectToRoom();
}


/*
    ============================================================
    RESTAURAÇÃO DA SESSÃO
    ============================================================
*/

async function restoreSavedSession() {

    const session =
        loadSession();

    if (
        !session ||
        !session.user ||
        !session.room
    ) {
        return;
    }

    restoringSession = true;

    currentUser =
        session.user;

    roomCode =
        normalizeRoomCode(
            session.room
        );

    roomInput.value =
        roomCode;

    roomName.textContent =
        roomCode;

    localName.textContent =
        currentUser;

    showToast(
        "Reconectando à sala..."
    );

    await enterRoom(roomCode);

    restoringSession = false;
}


/*
    ============================================================
    MÍDIA LOCAL
    ============================================================
*/

async function startLocalMedia() {

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {
                track.stop();
            });

        localStream = null;
    }

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    width: {
                        ideal: 1280
                    },
                    height: {
                        ideal: 720
                    },
                    frameRate: {
                        ideal: 30,
                        max: 60
                    }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

        localVideo.srcObject =
            localStream;

        localVideo.muted = true;

        updateMediaButtons();

    } catch (error) {

        console.error(
            "Erro ao acessar câmera/microfone:",
            error
        );

        try {

            localStream =
                await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });

            localVideo.srcObject =
                localStream;

            updateMediaButtons();

        } catch {

            localStream =
                new MediaStream();

            localVideo.srcObject =
                localStream;

            showToast(
                "Você entrou sem câmera."
            );
        }
    }
}


/*
    ============================================================
    PEERJS
    ============================================================
*/

async function connectToRoom() {

    const hostId =
        await roomPeerId(roomCode);

    const candidate =
        new Peer(
            hostId,
            PEER_CONFIG
        );

    let settled = false;

    candidate.on(
        "open",
        () => {

            if (settled) {
                return;
            }

            settled = true;

            peer = candidate;

            isHost = true;

            setupPeer();

            setConnectionStatus(
                "Sala criada"
            );

            addSystemMessage(
                "Você criou a sala."
            );
        }
    );


    candidate.on(
        "error",
        error => {

            if (settled) {
                return;
            }

            if (
                error.type ===
                "unavailable-id"
            ) {

                settled = true;

                candidate.destroy();

                connectAsParticipant(
                    hostId
                );

                return;
            }

            console.error(
                "PeerJS:",
                error
            );

            setConnectionStatus(
                "Erro de conexão"
            );
        }
    );
}


function connectAsParticipant(hostId) {

    peer =
        new Peer(
            undefined,
            PEER_CONFIG
        );

    isHost = false;

    peer.on(
        "open",
        () => {

            setupPeer();

            const connection =
                peer.connect(
                    hostId,
                    {
                        reliable: true,
                        metadata: {
                            type: "join",
                            name: currentUser
                        }
                    }
                );

            setupDataConnection(
                connection
            );

            setConnectionStatus(
                "Conectando..."
            );
        }
    );


    peer.on(
        "error",
        error => {

            console.error(
                "PeerJS:",
                error
            );

            setConnectionStatus(
                "Erro de conexão"
            );
        }
    );
}


function setupPeer() {

    peer.on(
        "connection",
        connection => {

            setupDataConnection(
                connection
            );
        }
    );


    peer.on(
        "call",
        call => {

            handleIncomingCall(
                call
            );
        }
    );


    peer.on(
        "disconnected",
        () => {

            setConnectionStatus(
                "Desconectado"
            );

            /*
                Tenta reconectar ao servidor
                de sinalização.
            */

            setTimeout(() => {

                if (
                    peer &&
                    !peer.destroyed
                ) {

                    try {
                        peer.reconnect();
                    } catch {}
                }

            }, 1500);
        }
    );


    peer.on(
        "close",
        () => {

            setConnectionStatus(
                "Encerrado"
            );
        }
    );
}


/*
    ============================================================
    CONEXÕES DE DADOS
    ============================================================
*/

function setupDataConnection(connection) {

    if (
        connections.has(
            connection.peer
        )
    ) {
        return;
    }

    connection.on(
        "open",
        () => {

            connections.set(
                connection.peer,
                connection
            );

            sendData(
                connection,
                {
                    type: "hello",
                    name: currentUser
                }
            );

            updateParticipantUI();

            if (isHost) {

                broadcastRoster();
            }

            /*
                Depois de conectar, tentamos
                iniciar a chamada de vídeo.
            */

            setTimeout(() => {

                ensureCameraCall(
                    connection.peer
                );

            }, 400);
        }
    );


    connection.on(
        "data",
        data => {

            handleData(
                connection,
                data
            );
        }
    );


    connection.on(
        "close",
        () => {

            handlePeerDisconnected(
                connection.peer
            );
        }
    );


    connection.on(
        "error",
        error => {

            console.error(
                "Data connection:",
                error
            );
        }
    );
}


function sendData(
    connection,
    data
) {

    if (
        !connection ||
        connection.open !== true
    ) {
        return false;
    }

    try {

        connection.send(data);

        return true;

    } catch (error) {

        console.error(
            "Erro enviando dados:",
            error
        );

        return false;
    }
}


/*
    ============================================================
    IDENTIDADES / PARTICIPANTES
    ============================================================
*/

function handleData(
    connection,
    data
) {

    if (
        !data ||
        typeof data !== "object"
    ) {
        return;
    }


    if (data.type === "hello") {

        remoteUsers.set(
            connection.peer,
            {
                name:
                    data.name ||
                    "Usuário",
                peerId:
                    connection.peer
            }
        );

        updateParticipantUI();

        if (isHost) {

            broadcastRoster();
        }

        ensureCameraCall(
            connection.peer
        );

        return;
    }


    if (data.type === "roster") {

        handleRoster(
            data.users || []
        );

        return;
    }


    if (data.type === "chat") {

        addChatMessage(
            data.name || "Usuário",
            data.text || "",
            false
        );

        return;
    }


    if (data.type === "file-start") {

        startIncomingFile(
            connection.peer,
            data
        );

        return;
    }


    if (data.type === "file-chunk") {

        receiveFileChunk(
            connection.peer,
            data
        );

        return;
    }


    if (data.type === "file-end") {

        finishIncomingFile(
            connection.peer,
            data
        );

        return;
    }
}


/*
    ============================================================
    ROSTER
    ============================================================
*/

function broadcastRoster() {

    if (!isHost) {
        return;
    }

    const users = [];

    users.push({
        peerId: peer.id,
        name: currentUser
    });

    remoteUsers.forEach(
        (user, peerId) => {

            users.push({
                peerId,
                name: user.name
            });
        }
    );

    connections.forEach(
        connection => {

            sendData(
                connection,
                {
                    type: "roster",
                    users
                }
            );
        }
    );
}


function handleRoster(users) {

    users.forEach(user => {

        if (!user.peerId) {
            return;
        }

        if (
            user.peerId ===
            peer.id
        ) {
            return;
        }

        remoteUsers.set(
            user.peerId,
            {
                name:
                    user.name ||
                    "Usuário",
                peerId:
                    user.peerId
            }
        );

        /*
            Cada participante tenta estabelecer
            uma conexão de dados com os outros.
        */

        if (
            !connections.has(
                user.peerId
            )
        ) {

            connectToPeer(
                user.peerId
            );
        }
    });

    updateParticipantUI();
}


function connectToPeer(peerId) {

    if (
        !peer ||
        peer.destroyed ||
        peerId === peer.id ||
        connections.has(peerId)
    ) {
        return;
    }

    try {

        const connection =
            peer.connect(
                peerId,
                {
                    reliable: true,
                    metadata: {
                        type: "peer",
                        name: currentUser
                    }
                }
            );

        setupDataConnection(
            connection
        );

    } catch (error) {

        console.error(
            "Erro conectando participante:",
            error
        );
    }
}


/*
    ============================================================
    CHAMADAS DE VÍDEO
    ============================================================
*/

function ensureCameraCall(peerId) {

    if (
        !localStream ||
        !peer ||
        peer.destroyed
    ) {
        return;
    }

    if (
        cameraCalls.has(peerId)
    ) {
        return;
    }

    /*
        Só um dos lados inicia a chamada.
        Isso evita chamadas duplicadas.

        O peer ID menor inicia.
    */

    if (
        peer.id.localeCompare(peerId) > 0
    ) {
        return;
    }

    try {

        const call =
            peer.call(
                peerId,
                localStream,
                {
                    metadata: {
                        type: "camera",
                        name: currentUser
                    }
                }
            );

        cameraCalls.set(
            peerId,
            call
        );

        setupOutgoingCameraCall(
            peerId,
            call
        );

    } catch (error) {

        console.error(
            "Erro iniciando chamada:",
            error
        );
    }
}


function setupOutgoingCameraCall(
    peerId,
    call
) {

    call.on(
        "stream",
        stream => {

            addRemoteVideo(
                peerId,
                stream,
                getRemoteName(peerId),
                "camera"
            );
        }
    );


    call.on(
        "close",
        () => {

            removeRemoteMedia(
                peerId,
                "camera"
            );

            cameraCalls.delete(
                peerId
            );
        }
    );


    call.on(
        "error",
        error => {

            console.error(
                "Chamada de vídeo:",
                error
            );

            removeRemoteMedia(
                peerId,
                "camera"
            );

            cameraCalls.delete(
                peerId
            );
        }
    );
}


function handleIncomingCall(call) {

    const peerId =
        call.peer;

    const type =
        call.metadata &&
        call.metadata.type
            ? call.metadata.type
            : "camera";


    if (type === "screen") {

        handleIncomingScreenCall(
            call
        );

        return;
    }


    /*
        Chamada de câmera.
    */

    if (
        cameraCalls.has(peerId)
    ) {

        try {
            call.close();
        } catch {}

        return;
    }

    cameraCalls.set(
        peerId,
        call
    );

    try {

        call.answer(
            localStream ||
            new MediaStream()
        );

    } catch (error) {

        console.error(
            "Erro respondendo chamada:",
            error
        );
    }


    call.on(
        "stream",
        stream => {

            addRemoteVideo(
                peerId,
                stream,
                getRemoteName(peerId),
                "camera"
            );
        }
    );


    call.on(
        "close",
        () => {

            removeRemoteMedia(
                peerId,
                "camera"
            );

            cameraCalls.delete(
                peerId
            );
        }
    );


    call.on(
        "error",
        error => {

            console.error(
                "Chamada recebida:",
                error
            );

            removeRemoteMedia(
                peerId,
                "camera"
            );

            cameraCalls.delete(
                peerId
            );
        }
    );
}


/*
    ============================================================
    VÍDEO REMOTO
    ============================================================
*/

function addRemoteVideo(
    peerId,
    stream,
    name,
    type
) {

    const key =
        type + "-" + peerId;

    let card =
        document.querySelector(
            `[data-media-id="${CSS.escape(key)}"]`
        );

    if (!card) {

        card =
            document.createElement(
                "article"
            );

        card.className =
            "videoCard remoteVideoCard";

        card.dataset.mediaId =
            key;

        card.innerHTML = `
            <video
                autoplay
                playsinline
            ></video>

            <div class="videoLabel">
                <span>
                    ${escapeHTML(name)}
                </span>
            </div>
        `;

        videoGrid.appendChild(
            card
        );
    }

    const video =
        card.querySelector("video");

    video.srcObject =
        stream;

    video.autoplay = true;
    video.playsInline = true;

    video.play().catch(() => {});

    emptyCall.classList.add(
        "hidden"
    );
}


function removeRemoteMedia(
    peerId,
    type
) {

    const key =
        type + "-" + peerId;

    const card =
        videoGrid.querySelector(
            `[data-media-id="${CSS.escape(key)}"]`
        );

    if (!card) {
        return;
    }

    const video =
        card.querySelector("video");

    if (video) {

        try {
            video.pause();
        } catch {}

        video.srcObject = null;
    }

    card.remove();

    updateEmptyCall();
}


function removeRemoteUser(peerId) {

    removeRemoteMedia(
        peerId,
        "camera"
    );

    removeRemoteMedia(
        peerId,
        "screen"
    );

    cameraCalls.delete(
        peerId
    );

    screenCalls.delete(
        peerId
    );

    remoteUsers.delete(
        peerId
    );

    updateParticipantUI();

    updateEmptyCall();
}


function handlePeerDisconnected(
    peerId
) {

    const connection =
        connections.get(peerId);

    if (connection) {

        try {
            connection.close();
        } catch {}
    }

    connections.delete(
        peerId
    );

    removeRemoteUser(
        peerId
    );
}


function updateEmptyCall() {

    const remoteVideos =
        videoGrid.querySelectorAll(
            ".remoteVideoCard"
        );

    if (
        remoteVideos.length === 0
    ) {

        emptyCall.classList.remove(
            "hidden"
        );

    } else {

        emptyCall.classList.add(
            "hidden"
        );
    }
}


function getRemoteName(peerId) {

    const user =
        remoteUsers.get(peerId);

    return user
        ? user.name
        : "Usuário";
}


/*
    ============================================================
    COMPARTILHAMENTO DE TELA
    ============================================================
*/

screenButton.addEventListener(
    "click",
    toggleScreenShare
);


async function toggleScreenShare() {

    if (screenStream) {

        stopScreenShare();

        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
    ) {

        showToast(
            "Seu navegador não permite compartilhar a tela."
        );

        return;
    }

    try {

        screenStream =
            await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

        screenButton.classList.add(
            "active"
        );

        const track =
            screenStream.getVideoTracks()[0];

        if (track) {

            track.addEventListener(
                "ended",
                () => {

                    stopScreenShare();
                }
            );
        }

        /*
            Envia a tela para todos.
        */

        connections.forEach(
            (connection, peerId) => {

                if (
                    connection.open
                ) {

                    sendScreenToPeer(
                        peerId
                    );
                }
            }
        );

        showToast(
            "Compartilhamento iniciado."
        );

    } catch (error) {

        console.error(
            "Compartilhamento:",
            error
        );

        screenStream = null;

        screenButton.classList.remove(
            "active"
        );
    }
}


function sendScreenToPeer(peerId) {

    if (
        !screenStream ||
        !peer
    ) {
        return;
    }

    if (
        screenCalls.has(peerId)
    ) {
        return;
    }

    try {

        const call =
            peer.call(
                peerId,
                screenStream,
                {
                    metadata: {
                        type: "screen",
                        name: currentUser
                    }
                }
            );

        screenCalls.set(
            peerId,
            call
        );

        call.on(
            "close",
            () => {

                removeRemoteMedia(
                    peerId,
                    "screen"
                );

                screenCalls.delete(
                    peerId
                );
            }
        );

        call.on(
            "error",
            error => {

                console.error(
                    "Tela:",
                    error
                );

                removeRemoteMedia(
                    peerId,
                    "screen"
                );

                screenCalls.delete(
                    peerId
                );
            }
        );

    } catch (error) {

        console.error(
            "Erro enviando tela:",
            error
        );
    }
}


function handleIncomingScreenCall(
    call
) {

    const peerId =
        call.peer;

    /*
        Se já existe uma tela desse usuário,
        fechamos a antiga.
    */

    if (
        screenCalls.has(peerId)
    ) {

        try {
            screenCalls
                .get(peerId)
                .close();
        } catch {}

        screenCalls.delete(
            peerId
        );
    }

    screenCalls.set(
        peerId,
        call
    );

    try {

        call.answer(
            new MediaStream()
        );

    } catch (error) {

        console.error(
            "Erro respondendo tela:",
            error
        );
    }


    call.on(
        "stream",
        stream => {

            addRemoteVideo(
                peerId,
                stream,
                getRemoteName(peerId) +
                    " — Tela",
                "screen"
            );
        }
    );


    call.on(
        "close",
        () => {

            removeRemoteMedia(
                peerId,
                "screen"
            );

            screenCalls.delete(
                peerId
            );
        }
    );


    call.on(
        "error",
        error => {

            console.error(
                "Tela recebida:",
                error
            );

            removeRemoteMedia(
                peerId,
                "screen"
            );

            screenCalls.delete(
                peerId
            );
        }
    );
}


function stopScreenShare() {

    if (!screenStream) {
        return;
    }

    screenStream
        .getTracks()
        .forEach(track => {

            try {
                track.stop();
            } catch {}
        });

    screenStream = null;

    screenCalls.forEach(
        (call, peerId) => {

            try {
                call.close();
            } catch {}

            removeRemoteMedia(
                peerId,
                "screen"
            );
        }
    );

    screenCalls.clear();

    screenButton.classList.remove(
        "active"
    );

    showToast(
        "Compartilhamento encerrado."
    );
}


/*
    ============================================================
    CHAT
    ============================================================
*/

chatForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        const text =
            chatInput.value.trim();

        if (!text) {
            return;
        }

        addChatMessage(
            currentUser,
            text,
            true
        );

        connections.forEach(
            connection => {

                sendData(
                    connection,
                    {
                        type: "chat",
                        name: currentUser,
                        text
                    }
                );
            }
        );

        chatInput.value = "";
    }
);


function addChatMessage(
    name,
    text,
    own
) {

    const message =
        document.createElement("div");

    message.className =
        own
            ? "chatMessage own"
            : "chatMessage";

    message.innerHTML = `
        <strong>
            ${escapeHTML(name)}
        </strong>
        <span>
            ${escapeHTML(text)}
        </span>
    `;

    messages.appendChild(
        message
    );

    messages.scrollTop =
        messages.scrollHeight;
}


function addSystemMessage(text) {

    const message =
        document.createElement("div");

    message.className =
        "systemMessage";

    message.textContent =
        text;

    messages.appendChild(
        message
    );

    messages.scrollTop =
        messages.scrollHeight;
}


/*
    ============================================================
    ARQUIVOS
    ============================================================
*/

fileInput.addEventListener(
    "change",
    async () => {

        const file =
            fileInput.files[0];

        if (!file) {
            return;
        }

        /*
            Guarda a sessão imediatamente.
            Isso é importante no celular caso o
            navegador seja recarregado ao abrir
            o explorador de arquivos.
        */

        saveSession();

        await sendFile(
            file
        );

        /*
            Permite escolher o mesmo arquivo
            novamente depois.
        */

        fileInput.value = "";
    }
);


async function sendFile(file) {

    if (
        connections.size === 0
    ) {

        showToast(
            "Não há ninguém conectado."
        );

        return;
    }

    const fileId =
        createId();

    const chunkSize =
        48 * 1024;

    showFileStatus(
        `${file.name} — enviando...`
    );

    connections.forEach(
        connection => {

            sendData(
                connection,
                {
                    type: "file-start",
                    id: fileId,
                    name: file.name,
                    size: file.size,
                    mime:
                        file.type ||
                        "application/octet-stream",
                    sender: currentUser
                }
            );
        }
    );

    let offset = 0;

    while (
        offset < file.size
    ) {

        const slice =
            file.slice(
                offset,
                offset + chunkSize
            );

        const buffer =
            await slice.arrayBuffer();

        connections.forEach(
            connection => {

                sendData(
                    connection,
                    {
                        type: "file-chunk",
                        id: fileId,
                        chunk: buffer
                    }
                );
            }
        );

        offset +=
            buffer.byteLength;

        /*
            Dá uma pequena pausa para não
            sobrecarregar o celular.
        */

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    0
                )
        );
    }

    connections.forEach(
        connection => {

            sendData(
                connection,
                {
                    type: "file-end",
                    id: fileId
                }
            );
        }
    );

    showFileStatus(
        `${file.name} — enviado.`
    );
}


function startIncomingFile(
    peerId,
    data
) {

    incomingFiles.set(
        data.id,
        {
            peerId,
            name:
                data.name ||
                "arquivo",
            size:
                data.size || 0,
            mime:
                data.mime ||
                "application/octet-stream",
            sender:
                data.sender ||
                getRemoteName(peerId),
            chunks: [],
            received: 0
        }
    );

    showFileStatus(
        `${data.name} — recebendo...`
    );
}


function receiveFileChunk(
    peerId,
    data
) {

    const transfer =
        incomingFiles.get(
            data.id
        );

    if (!transfer) {
        return;
    }

    let chunk =
        data.chunk;

    if (
        chunk instanceof ArrayBuffer
    ) {

        transfer.chunks.push(
            chunk
        );

        transfer.received +=
            chunk.byteLength;

    } else if (
        chunk instanceof Uint8Array
    ) {

        const buffer =
            chunk.buffer.slice(
                chunk.byteOffset,
                chunk.byteOffset +
                    chunk.byteLength
            );

        transfer.chunks.push(
            buffer
        );

        transfer.received +=
            chunk.byteLength;
    }
}


function finishIncomingFile(
    peerId,
    data
) {

    const transfer =
        incomingFiles.get(
            data.id
        );

    if (!transfer) {
        return;
    }

    const blob =
        new Blob(
            transfer.chunks,
            {
                type: transfer.mime
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const item =
        document.createElement("div");

    item.className =
        "fileItem";

    item.innerHTML = `
        <strong>
            ${escapeHTML(transfer.name)}
        </strong>

        <span>
            ${escapeHTML(transfer.sender)}
        </span>

        <a
            href="${url}"
            download="${escapeHTML(transfer.name)}"
        >
            Baixar
        </a>
    `;

    fileList.appendChild(
        item
    );

    incomingFiles.delete(
        data.id
    );

    showFileStatus(
        `${transfer.name} — recebido.`
    );
}


function showFileStatus(text) {

    const item =
        document.createElement("div");

    item.className =
        "fileItem";

    item.textContent =
        text;

    fileList.appendChild(
        item
    );

    fileList.scrollTop =
        fileList.scrollHeight;
}


/*
    ============================================================
    PARTICIPANTES
    ============================================================
*/

function updateParticipantUI() {

    participantList.innerHTML = "";

    const self =
        document.createElement("div");

    self.className =
        "participant";

    self.innerHTML = `
        <span class="avatar">
            ${escapeHTML(
                currentUser
                    ? currentUser
                        .charAt(0)
                        .toUpperCase()
                    : "?"
            )}
        </span>

        <span>
            ${escapeHTML(
                currentUser ||
                "Você"
            )}
        </span>

        <small>
            Você
        </small>
    `;

    participantList.appendChild(
        self
    );


    remoteUsers.forEach(
        user => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "participant";

            item.innerHTML = `
                <span class="avatar">
                    ${escapeHTML(
                        user.name
                            .charAt(0)
                            .toUpperCase()
                    )}
                </span>

                <span>
                    ${escapeHTML(
                        user.name
                    )}
                </span>
            `;

            participantList.appendChild(
                item
            );
        }
    );


    participantCount.textContent =
        String(
            remoteUsers.size + 1
        );
}


/*
    ============================================================
    CONTROLES
    ============================================================
*/

micButton.addEventListener(
    "click",
    () => {

        if (!localStream) {
            return;
        }

        const tracks =
            localStream.getAudioTracks();

        tracks.forEach(
            track => {
                track.enabled =
                    !track.enabled;
            }
        );

        updateMediaButtons();
    }
);


cameraButton.addEventListener(
    "click",
    () => {

        if (!localStream) {
            return;
        }

        const tracks =
            localStream.getVideoTracks();

        tracks.forEach(
            track => {
                track.enabled =
                    !track.enabled;
            }
        );

        updateMediaButtons();
    }
);


speakerButton.addEventListener(
    "click",
    () => {

        const videos =
            document.querySelectorAll(
                "video:not(#localVideo)"
            );

        const muted =
            videos.length > 0 &&
            videos[0].muted;

        videos.forEach(
            video => {
                video.muted =
                    !muted;
            }
        );

        speakerButton.classList.toggle(
            "active",
            !muted
        );
    }
);


function updateMediaButtons() {

    if (!localStream) {
        return;
    }

    const audioTracks =
        localStream.getAudioTracks();

    const videoTracks =
        localStream.getVideoTracks();

    const audioEnabled =
        audioTracks.some(
            track =>
                track.enabled
        );

    const videoEnabled =
        videoTracks.some(
            track =>
                track.enabled
        );

    micButton.classList.toggle(
        "active",
        audioEnabled
    );

    cameraButton.classList.toggle(
        "active",
        videoEnabled
    );
}


/*
    ============================================================
    COPIAR SALA
    ============================================================
*/

copyRoomButton.addEventListener(
    "click",
    async () => {

        if (!roomCode) {
            return;
        }

        try {

            await navigator.clipboard.writeText(
                roomCode
            );

            showToast(
                "Código copiado."
            );

        } catch {

            showToast(
                "Não foi possível copiar."
            );
        }
    }
);


/*
    ============================================================
    STATUS
    ============================================================
*/

function setConnectionStatus(
    text
) {

    connectionStatusText.textContent =
        text;

    if (
        text === "Erro de conexão" ||
        text === "Desconectado" ||
        text === "Encerrado"
    ) {

        statusDot.classList.remove(
            "connected"
        );

    } else {

        statusDot.classList.add(
            "connected"
        );
    }
}


/*
    ============================================================
    SAIR
    ============================================================
*/

leaveButton.addEventListener(
    "click",
    leaveRoom
);


function leaveRoom() {

    clearSession();

    stopScreenShare();


    cameraCalls.forEach(
        call => {

            try {
                call.close();
            } catch {}
        }
    );

    cameraCalls.clear();


    screenCalls.forEach(
        call => {

            try {
                call.close();
            } catch {}
        }
    );

    screenCalls.clear();


    connections.forEach(
        connection => {

            try {
                connection.close();
            } catch {}
        }
    );

    connections.clear();


    remoteUsers.clear();


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                try {
                    track.stop();
                } catch {}
            });

        localStream = null;
    }


    if (peer) {

        try {
            peer.destroy();
        } catch {}

        peer = null;
    }


    localVideo.srcObject =
        null;

    roomCode = null;
    currentUser = null;
    isHost = false;

    app.classList.add(
        "hidden"
    );

    showScreen(
        passwordScreen
    );

    addSystemMessage(
        "Você saiu da sala."
    );
}


/*
    ============================================================
    PROTEÇÃO CONTRA RELOAD / TROCA DE APP
    ============================================================
*/

/*
    O navegador pode executar este evento quando
    o usuário abre o explorador de arquivos,
    troca de aplicativo ou a página é recarregada.

    Não destruímos a sessão aqui.
*/

window.addEventListener(
    "pagehide",
    () => {

        if (
            currentUser &&
            roomCode
        ) {

            saveSession();
        }
    }
);


window.addEventListener(
    "beforeunload",
    () => {

        if (
            currentUser &&
            roomCode
        ) {

            saveSession();
        }
    }
);


/*
    Quando voltamos para a página, verificamos
    se a conexão ainda está viva.
*/

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (
                roomCode &&
                peer &&
                peer.disconnected
            ) {

                try {
                    peer.reconnect();
                } catch {}
            }
        }
    }
);


/*
    ============================================================
    INICIALIZAÇÃO
    ============================================================
*/

window.addEventListener(
    "load",
    async () => {

        const session =
            loadSession();

        /*
            Só restauramos automaticamente se
            existir uma sessão salva.

            Se o usuário apertou "Sair",
            a sessão foi apagada.
        */

        if (
            session &&
            session.user &&
            session.room
        ) {

            try {

                currentUser =
                    session.user;

                roomCode =
                    normalizeRoomCode(
                        session.room
                    );

                roomInput.value =
                    roomCode;

                await restoreSavedSession();

            } catch (error) {

                console.error(
                    "Erro restaurando sessão:",
                    error
                );

                clearSession();

                currentUser = null;
                roomCode = null;

                showScreen(
                    passwordScreen
                );
            }
        }
    }
);