/**
 * Goma Security - Citizen App JavaScript
 */

// =====================
// CONFIGURATION
// =====================

const API_URL = 'https://gomasecure-backend.onrender.com';
const SOCKET_URL = 'https://gomasecure-backend.onrender.com';

// Goma default coordinates
const DEFAULT_LAT = -1.6585;
const DEFAULT_LNG = 29.2205;

// =====================
// STATE
// =====================

let currentUser = null;
let map = null;
let userMarker = null;
let currentPosition = null;
let emergencyTypes = [];
let selectedEmergencyType = null;
let tempToken = null;
let socket = null;

// =====================
// AUTHENTICATION
// =====================

// Check for existing session
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // Decode token to get user role
        const userRole = getUserRoleFromToken(token);
        
        // Role-based redirection for existing sessions
        if (userRole === 'admin') {
            // Redirect to admin panel
            localStorage.setItem('admin_token', token);
            window.location.href = '/admin.html';
        } else if (userRole === 'security_center') {
            // Redirect to security center
            localStorage.setItem('admin_token', token);
            window.location.href = '/security-center.html';
        } else if (userRole === 'poste') {
            // Redirect to poste interface
            localStorage.setItem('poste_token', token);
            window.location.href = '/poste.html';
        } else {
            // Citizen - show dashboard
            showDashboard();
            initApp();
        }
    }
}

// Get user role from JWT token
function getUserRoleFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.role;
    } catch (e) {
        return null;
    }
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const telephone = document.getElementById('login-telephone').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telephone, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.requires2FA) {
                tempToken = data.tempToken;
                showSection('verify-2fa-section');
                showToast('Veuillez entrer votre code 2FA', 'info');
            } else {
                localStorage.setItem('token', data.token);
                currentUser = data.user;
                
                // Role-based redirection
                if (currentUser.role === 'admin') {
                    // Redirect to admin panel
                    localStorage.setItem('admin_token', data.token);
                    window.location.href = '/admin.html';
                } else if (currentUser.role === 'security_center') {
                    // Redirect to security center
                    localStorage.setItem('admin_token', data.token);
                    window.location.href = '/security-center.html';
                } else if (currentUser.role === 'poste') {
                    // Redirect to poste interface
                    localStorage.setItem('poste_token', data.token);
                    window.location.href = '/poste.html';
                } else {
                    // Citizen - stay on current interface
                    showDashboard();
                    initApp();
                }
            }
        } else {
            showToast(data.error || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion au serveur', 'error');
    }
});

// Verify 2FA
document.getElementById('verify-2fa-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('2fa-code').value;
    
    try {
        const response = await fetch(`${API_URL}/api/auth/verify-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken, code })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            
            // Role-based redirection after 2FA
            if (currentUser.role === 'admin') {
                // Redirect to admin panel
                localStorage.setItem('admin_token', data.token);
                window.location.href = '/admin.html';
            } else if (currentUser.role === 'security_center') {
                // Redirect to security center
                localStorage.setItem('admin_token', data.token);
                window.location.href = '/security-center.html';
            } else if (currentUser.role === 'poste') {
                // Redirect to poste interface
                localStorage.setItem('poste_token', data.token);
                window.location.href = '/poste.html';
            } else {
                // Citizen - stay on current interface
                showDashboard();
                initApp();
            }
        } else {
            showToast(data.error || 'Code invalide', 'error');
        }
    } catch (error) {
        showToast('Erreur de verification', 'error');
    }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        nom: document.getElementById('reg-nom').value,
        prenom: document.getElementById('reg-prenom').value,
        telephone: document.getElementById('reg-telephone').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        quartier: document.getElementById('reg-quartier').value,
        avenue: document.getElementById('reg-avenue').value
    };
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showToast('Inscription reussie!', 'success');
            showDashboard();
            initApp();
        } else {
            showToast(data.error || 'Erreur d\'inscription', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion au serveur', 'error');
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('poste_token');
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    showSection('login-section');
    showToast('Deconnexion reussie', 'success');
});

// =====================
// NAVIGATION
// =====================

document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('register-section');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('login-section');
});

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
        section.style.display = '';
    });
    document.getElementById(sectionId).classList.add('active');
}

function showDashboard() {
    showSection('dashboard-section');
}

// =====================
// APP INITIALIZATION
// =====================

async function initApp() {
    await loadEmergencyTypes();
    initMap();
    initSocket();
    getUserLocation();
    loadUserProfile();
}

// Load emergency types
async function loadEmergencyTypes() {
    try {
        const response = await fetch(`${API_URL}/api/emergency-types`);
        emergencyTypes = await response.json();
        renderEmergencyTypes();
    } catch (error) {
        showToast('Erreur de chargement des types d\'urgence', 'error');
    }
}

// Render emergency types in form
function renderEmergencyTypes() {
    const container = document.getElementById('emergency-types');
    container.innerHTML = emergencyTypes.map(type => `
        <button type="button" class="emergency-type-btn" data-id="${type.id}" data-priority="${type.priorite}" style="border-color: ${type.couleur}">
            <i class="fas ${type.icone}" style="color: ${type.couleur}"></i>
            <span>${type.nom}</span>
        </button>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.emergency-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.emergency-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedEmergencyType = {
                id: btn.dataset.id,
                priority: btn.dataset.priority
            };
        });
    });
}

// =====================
// MAP
// =====================

function initMap() {
    map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LNG], 13);
    
    // Use CartoDB Voyager tiles (colored, more detailed)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    // Add Google Maps button
    const googleMapsBtn = L.control({position: 'bottomright'});
    googleMapsBtn.onAdd = function() {
        const div = L.DomUtil.create('div', 'google-maps-btn');
        div.innerHTML = '<a href="https://www.google.com/maps" target="_blank"><i class="fab fa-google"></i> Google Maps</a>';
        return div;
    };
    googleMapsBtn.addTo(map);
    
    // Add Goma marker
    L.marker([DEFAULT_LAT, DEFAULT_LNG])
        .addTo(map)
        .bindPopup('Goma, RDC');
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                updateLocationDisplay();
                
                // Update or create marker
                if (userMarker) {
                    userMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
                } else {
                    userMarker = L.marker([currentPosition.lat, currentPosition.lng], {
                        icon: L.divIcon({
                            className: 'user-marker',
                            html: '<i class="fas fa-user-circle" style="color: #3498db; font-size: 24px;"></i>',
                            iconSize: [30, 30]
                        })
                    }).addTo(map);
                }
                
                map.setView([currentPosition.lat, currentPosition.lng], 15);
            },
            (error) => {
                console.log('Geolocation error:', error);
                showToast('Impossible d\'obtenir votre position', 'warning');
            },
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
    }
}

function updateLocationDisplay() {
    if (currentPosition) {
        document.querySelector('#alert-location .lat').textContent = `Lat: ${currentPosition.lat.toFixed(6)}`;
        document.querySelector('#alert-location .lng').textContent = `Lng: ${currentPosition.lng.toFixed(6)}`;
    }
}

// =====================
// ALERTS
// =====================

// Emergency button
document.getElementById('emergency-btn').addEventListener('click', () => {
    if (!currentPosition) {
        getUserLocation();
    }
    document.getElementById('alert-form-container').classList.remove('hidden');
});

// Close alert form
document.getElementById('close-alert-form').addEventListener('click', () => {
    document.getElementById('alert-form-container').classList.add('hidden');
});

document.getElementById('cancel-alert').addEventListener('click', () => {
    document.getElementById('alert-form-container').classList.add('hidden');
});

// Submit alert
document.getElementById('alert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedEmergencyType) {
        showToast('Veuillez selectionner un type d\'urgence', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('type_id', selectedEmergencyType.id);
    formData.append('description', document.getElementById('alert-description').value);
    formData.append('priority', selectedEmergencyType.priority);
    
    if (currentPosition) {
        formData.append('latitude', currentPosition.lat);
        formData.append('longitude', currentPosition.lng);
        formData.append('accuracy', currentPosition.accuracy);
    }
    
    const photoFile = document.getElementById('alert-photo').files[0];
    if (photoFile) {
        formData.append('photo', photoFile);
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/alerts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Alerte envoyee avec succes!', 'success');
            document.getElementById('alert-form-container').classList.add('hidden');
            document.getElementById('alert-form').reset();
            selectedEmergencyType = null;
            document.querySelectorAll('.emergency-type-btn').forEach(b => b.classList.remove('selected'));
            showToast('Alerte envoyee avec succes!', 'success');
            document.getElementById('alert-form-container').classList.add('hidden');
            document.getElementById('alert-form').reset();
            selectedEmergencyType = null;
            // Show history after sending alert
            document.getElementById('dashboard-section').classList.remove('active');
            document.getElementById('history-section').classList.add('active');
            loadHistory();
        } else {
            showToast(data.error || 'Erreur lors de l\'envoi', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

// Load my alerts
async function loadMyAlerts() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/alerts/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const alerts = await response.json();
        renderAlerts(alerts);
    } catch (error) {
        showToast('Erreur de chargement des alertes', 'error');
    }
}

// Render alerts
function renderAlerts(alerts) {
    const container = document.getElementById('alerts-list');
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>Aucune alerte</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-card status-${alert.status}">
            <div class="alert-header">
                <div class="alert-type">
                    <i class="fas ${alert.icone}" style="background: ${alert.couleur}"></i>
                    <div>
                        <strong>${alert.type_nom}</strong>
                        <div class="alert-meta">
                            <span>${formatDate(alert.created_at)}</span>
                        </div>
                    </div>
                </div>
                <span class="alert-status ${alert.status}">${getStatusLabel(alert.status)}</span>
            </div>
            <p class="alert-description">${alert.description || 'Sans description'}</p>
            <div class="alert-meta">
                ${alert.quartier ? `<span><i class="fas fa-map-marker-alt"></i> ${alert.quartier}</span>` : ''}
                ${alert.avenue ? `<span><i class="fas fa-road"></i> ${alert.avenue}</span>` : ''}
            </div>
            <div class="alert-actions">
                <button class="btn-delete" onclick="deleteAlert(${alert.id})">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
    `).join('');
}


// =====================
// PROFILE
// =====================

async function loadUserProfile() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const user = await response.json();
        
        document.getElementById('profile-nom').value = user.nom || '';
        document.getElementById('profile-prenom').value = user.prenom || '';
        document.getElementById('profile-email').value = user.email || '';
        document.getElementById('profile-quartier').value = user.quartier || '';
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Open profile modal
document.getElementById('btn-profile').addEventListener('click', () => {
    document.getElementById('profile-modal').classList.remove('hidden');
});

// Open history section
document.getElementById('btn-history').addEventListener('click', () => {
    document.getElementById('dashboard-section').classList.remove('active');
    document.getElementById('chat-section').classList.remove('active');
    document.getElementById('history-section').classList.add('active');
    loadHistory();
});

// Open chat section
document.getElementById('btn-chat').addEventListener('click', () => {
    document.getElementById('dashboard-section').classList.remove('active');
    document.getElementById('history-section').classList.remove('active');
    document.getElementById('chat-section').classList.add('active');
    loadChatMessages();
});

// Back to dashboard from history
document.getElementById('back-to-dashboard').addEventListener('click', () => {
    document.getElementById('history-section').classList.remove('active');
    document.getElementById('dashboard-section').classList.add('active');
});

// Back to dashboard from chat
document.getElementById('back-to-dashboard-from-chat').addEventListener('click', () => {
    document.getElementById('chat-section').classList.remove('active');
    document.getElementById('dashboard-section').classList.add('active');
});

// =====================
// CHAT FUNCTIONALITY
// =====================

// Load chat messages
async function loadChatMessages() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/chat/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const messages = await response.json();
            renderChatMessages(messages);
        } else {
            chatMessages.innerHTML = '<p class="empty-message">Erreur de chargement</p>';
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        chatMessages.innerHTML = '<p class="empty-message">Erreur de connexion</p>';
    }
}

// Render chat messages
function renderChatMessages(messages) {
    const chatMessages = document.getElementById('chat-messages');
    
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = '<p class="empty-message">Aucun message. Commencez la discussion!</p>';
        return;
    }
    
    const currentUserId = getCurrentUserId();
    
    chatMessages.innerHTML = messages.map(msg => {
        let messageContent = msg.message;
        
        // If there's an audio path, show audio player
        if (msg.audio_path) {
            messageContent = `<audio controls src="${msg.audio_path}" class="voice-message"></audio>`;
        }
        
        const isOwnMessage = msg.sender_id === currentUserId;
        
        return `
            <div class="chat-message ${isOwnMessage ? 'sent' : 'received'}" data-id="${msg.id}">
                <div class="message-content">${messageContent}</div>
                <div class="message-footer">
                    <div class="message-time">${formatDate(msg.created_at)}</div>
                    ${isOwnMessage ? `<button class="btn-delete-message" onclick="deleteMessage(${msg.id})"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Delete message
async function deleteMessage(messageId) {
    if (!confirm('Voulez-vous vraiment supprimer ce message?')) return;
    
    // Optimistic update - remove from UI immediately
    const messageElement = document.querySelector(`.chat-message[data-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            showToast('Message supprimé', 'success');
        } else {
            // If API fails, reload to restore state
            const error = await response.json();
            showToast(error.error || 'Erreur de suppression', 'error');
            loadChatMessages();
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Erreur de connexion', 'error');
        // Reload to restore state on error
        loadChatMessages();
    }
}

// Make deleteMessage available globally
window.deleteMessage = deleteMessage;

// Get current user ID from token
function getCurrentUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id;
    } catch (e) {
        return null;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Send chat message
document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    input.value = '';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/chat/messages`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            // Reload messages
            loadChatMessages();
        } else {
            showToast('Erreur d\'envoi du message', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Erreur de connexion', 'error');
    }
});

// Voice Recording for Citizen
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

async function initVoiceRecording() {
    const voiceBtn = document.getElementById('btn-voice-citizen');
    if (!voiceBtn) return;
    
    voiceBtn.addEventListener('click', async () => {
        if (!isRecording) {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Use webm by default (most widely supported)
                const mimeType = 'audio/webm';
                
                mediaRecorder = new MediaRecorder(stream, { mimeType });
                audioChunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = async () => {
                    if (audioChunks.length === 0) {
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }
                    
                    const audioBlob = new Blob(audioChunks, { type: mimeType });
                    await sendVoiceMessage(audioBlob, 'webm');
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start(1000); // Collect data every second
                isRecording = true;
                voiceBtn.classList.add('recording');
                showToast('Enregistrement en cours...', 'info');
            } catch (error) {
                console.error('Error accessing microphone:', error);
                showToast('Erreur d\'accès au microphone', 'error');
            }
        } else {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isRecording = false;
            voiceBtn.classList.remove('recording');
        }
    });
}

async function sendVoiceMessage(audioBlob, extension = 'webm') {
    try {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('audio', audioBlob, `voice.${extension}`);
        
        console.log('Sending voice message, blob size:', audioBlob.size);
        
        const response = await fetch(`${API_URL}/api/chat/voice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        console.log('Voice response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            showToast('Message vocal envoyé', 'success');
            loadChatMessages();
        } else {
            const error = await response.json();
            showToast('Erreur: ' + (error.error || 'Erreur d\'envoi du message vocal'), 'error');
        }
    } catch (error) {
        console.error('Error sending voice message:', error);
        showToast('Erreur de connexion', 'error');
    }
}

// Initialize voice recording when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initVoiceRecording, 1000);
});

// Listen for new chat messages via Socket.IO
function initChatSocket() {
    if (typeof socket !== 'undefined') {
        socket.on('chat-message', (data) => {
            // Only show message if chat is open
            const chatSection = document.getElementById('chat-section');
            if (chatSection.classList.contains('active')) {
                loadChatMessages();
            }
        });
        
        // Listen for deleted messages
        socket.on('chat-message-deleted', (data) => {
            const chatSection = document.getElementById('chat-section');
            if (chatSection.classList.contains('active')) {
                loadChatMessages();
            }
        });
    }
}

// Load history
async function loadHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const token = localStorage.getItem('token');
        console.log('Loading history, token:', token ? 'present' : 'missing');
        
        const response = await fetch(`${API_URL}/api/alerts/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('History response status:', response.status);
        
        if (response.ok) {
            const alerts = await response.json();
            console.log('Alerts loaded:', alerts.length);
            renderHistoryAlerts(alerts);
        } else {
            const errorData = await response.json();
            console.error('Error loading history:', errorData);
            historyList.innerHTML = `<p class="empty-message">Erreur: ${errorData.error || 'Inconnu'}</p>`;
        }
    } catch (error) {
        console.error('Error loading history:', error);
        historyList.innerHTML = '<p class="empty-message">Erreur de connexion</p>';
    }
}

// Render history alerts with delete button
function renderHistoryAlerts(alerts) {
    const historyList = document.getElementById('history-list');
    
    if (alerts.length === 0) {
        historyList.innerHTML = '<p class="empty-message">Aucune alerte dans votre historique</p>';
        return;
    }
    
    historyList.innerHTML = alerts.map(alert => `
        <div class="alert-card status-${alert.status}" data-id="${alert.id}">
            <div class="alert-header">
                <div class="alert-type">
                    <i class="fas ${alert.icone}" style="background: ${alert.couleur}"></i>
                    <span>${alert.type_nom}</span>
                </div>
                <span class="alert-status ${alert.status}">${getStatusLabel(alert.status)}</span>
            </div>
            ${alert.description ? `<p class="alert-description">${alert.description}</p>` : ''}
            <div class="alert-meta">
                <span><i class="fas fa-clock"></i> ${formatDate(alert.created_at)}</span>
                ${alert.quartier ? `<span><i class="fas fa-map-marker-alt"></i> ${alert.quartier}</span>` : ''}
                ${alert.avenue ? `<span><i class="fas fa-road"></i> ${alert.avenue}</span>` : ''}
            </div>
            <div class="alert-actions">
                <button class="btn-delete" onclick="deleteAlert(${alert.id})">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
    `).join('');
}

// Delete alert
async function deleteAlert(alertId) {
    if (!confirm('Voulez-vous vraiment supprimer cette alerte?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            showToast('Alerte supprimee', 'success');
            loadHistory(); // Reload history
        } else {
            showToast('Erreur de suppression', 'error');
        }
    } catch (error) {
        console.error('Error deleting alert:', error);
        showToast('Erreur de connexion', 'error');
    }
}

// Make deleteAlert available globally
window.deleteAlert = deleteAlert;

// Close modals
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.modal).classList.add('hidden');
    });
});

// Update profile
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        nom: document.getElementById('profile-nom').value,
        prenom: document.getElementById('profile-prenom').value,
        email: document.getElementById('profile-email').value,
        quartier: document.getElementById('profile-quartier').value
    };
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/user/profile`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showToast('Profil mis a jour', 'success');
        } else {
            showToast('Erreur de mise a jour', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

// Setup 2FA
document.getElementById('setup-2fa').addEventListener('click', async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/auth/setup-2fa`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('2fa-qrcode').src = data.qrCode;
            document.getElementById('2fa-secret').textContent = data.secret;
            document.getElementById('2fa-modal').classList.remove('hidden');
        }
    } catch (error) {
        showToast('Erreur de configuration', 'error');
    }
});

// Enable 2FA
document.getElementById('enable-2fa-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('enable-2fa-code').value;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/auth/enable-2fa`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code })
        });
        
        if (response.ok) {
            showToast('2FA active avec succes', 'success');
            document.getElementById('2fa-modal').classList.add('hidden');
        } else {
            const data = await response.json();
            showToast(data.error || 'Erreur d\'activation', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

// =====================
// SOCKET.IO
// =====================

function initSocket() {
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('Connected to socket server');
    });
    
    socket.on('alert-updated', (data) => {
        // Reload history when an alert is updated
        loadHistory();
    });
    
    // Initialize chat socket listeners
    initChatSocket();
}

// =====================
// UTILITIES
// =====================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusLabel(status) {
    const labels = {
        'active': 'Active',
        'en_cours': 'En cours',
        'resolu': 'Resolu'
    };
    return labels[status] || status;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// =====================
// PWA - SERVICE WORKER
// =====================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}

// =====================
// INITIALIZE
// =====================

document.addEventListener('DOMContentLoaded', checkAuth);
