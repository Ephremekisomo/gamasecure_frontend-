/**
 * Goma Security - Security Center JavaScript
 */

// =====================
// CONFIGURATION
// =====================

const API_URL = 'https://gomasecure-backend.onrender.com';
const SOCKET_URL = 'https://gomasecure-backend.onrender.com';
const DEFAULT_LAT = -1.6585;
const DEFAULT_LNG = 29.2205;

// =====================
// STATE
// =====================

let currentUser = null;
let socket = null;
let map = null;
let alertMarkers = {};
let alerts = [];
let selectedAlert = null;
let soundEnabled = true;
let alertSoundInterval = null;

// =====================
// AUTHENTICATION
// =====================

function checkAuth() {
    const token = localStorage.getItem('admin_token');
    if (token) {
        showDashboard();
        initApp();
    }
}

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
        
        if (response.ok && data.user && data.user.role === 'admin') {
            localStorage.setItem('admin_token', data.token);
            currentUser = data.user;
            showDashboard();
            initApp();
        } else if (response.ok) {
            showToast('Acces reserve aux administrateurs', 'error');
        } else {
            showToast(data.error || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion au serveur', 'error');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('token');
    localStorage.removeItem('poste_token');
    currentUser = null;
    if (socket) socket.disconnect();
    showSection('login-section');
    showToast('Deconnexion reussie', 'success');
});

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(s => {
        s.classList.remove('active');
        s.style.display = '';
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
    initMap();
    await loadAlerts();
    await loadStats();
    initSocket();
    
    // Auto-refresh stats every 10 seconds
    setInterval(loadStats, 10000);
}

// =====================
// MAP
// =====================

function initMap() {
    map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LNG], 12);
    
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
    
    // Add Goma reference marker
    L.marker([DEFAULT_LAT, DEFAULT_LNG])
        .addTo(map)
        .bindPopup('<b>Goma, RDC</b><br>Centre-ville');
}

// =====================
// ALERTS
// =====================

async function loadAlerts() {
    const status = document.getElementById('filter-status').value;
    const priority = document.getElementById('filter-priority').value;
    
    let url = `${API_URL}/api/alerts?`;
    if (status) url += `status=${status}&`;
    if (priority) url += `priority=${priority}&`;
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        alerts = await response.json();
        renderAlerts();
        updateMapMarkers();
    } catch (error) {
        showToast('Erreur de chargement des alertes', 'error');
    }
}

function renderAlerts() {
    const container = document.getElementById('sidebar-alerts');
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle" style="color: var(--success-color); font-size: 40px;"></i>
                <p>Aucune alerte</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item status-${alert.status}" data-id="${alert.id}">
            <div class="alert-item-header">
                <div class="alert-item-type">
                    <i class="fas ${alert.icone}" style="background: ${alert.couleur}"></i>
                    <span>${alert.type_nom}</span>
                </div>
                <span class="alert-item-status ${alert.status}">${getStatusLabel(alert.status)}</span>
            </div>
            <div class="alert-item-meta">
                ${alert.nom} ${alert.prenom} - ${formatDate(alert.created_at)}
                <span class="alert-item-priority">P${alert.priority}</span>
                ${alert.assigned_to ? `<span class="alert-item-assigned">${getPosteLabel(alert.assigned_to)}</span>` : ''}
            </div>
            <div class="alert-item-actions">
                <button class="btn-details" data-id="${alert.id}" title="Voir les details">
                    <i class="fas fa-eye"></i> Details
                </button>
                ${alert.photo ? `<button class="btn-photo" data-photo="${alert.photo}" title="Voir la photo">
                    <i class="fas fa-camera"></i> Photo
                </button>` : ''}
                <button class="btn-assign" data-id="${alert.id}" title="Assigner a un poste">
                    <i class="fas fa-share"></i> Assigner
                </button>
            </div>
        </div>
    `).join('');
    
    // Add click handlers for details
    container.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const alertId = parseInt(btn.dataset.id);
            showAlertDetails(alertId);
        });
    });
    
    // Add click handlers for photo
    container.querySelectorAll('.btn-photo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const photoUrl = btn.dataset.photo;
            showPhotoModal(photoUrl);
        });
    });
    
    // Add click handlers for assign
    container.querySelectorAll('.btn-assign').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const alertId = parseInt(btn.dataset.id);
            // Direct assignment without modal
            assignAlertDirectly(alertId);
        });
    });
    
    // Add click handlers for alert items
    container.querySelectorAll('.alert-item').forEach(item => {
        item.addEventListener('click', () => {
            const alertId = parseInt(item.dataset.id);
            showAlertDetails(alertId);
        });
    });
}

function updateMapMarkers() {
    // Remove existing markers
    Object.values(alertMarkers).forEach(marker => map.removeLayer(marker));
    alertMarkers = {};
    
    alerts.forEach(alert => {
        if (alert.latitude && alert.longitude) {
            const markerClass = alert.status ? `alert-marker status-${alert.status}` : 'alert-marker';
            const marker = L.marker([alert.latitude, alert.longitude], {
                icon: L.divIcon({
                    className: markerClass,
                    html: `<i class="fas ${alert.icone}" style="background: ${alert.couleur}; color: white; padding: 8px; border-radius: 50%;"></i>`,
                    iconSize: [30, 30]
                })
            }).addTo(map);
            
            marker.on('click', () => showAlertDetails(alert.id));
            alertMarkers[alert.id] = marker;
        }
    });
}

function showAlertDetails(alertId) {
    selectedAlert = alerts.find(a => a.id === alertId);
    if (!selectedAlert) return;
    
    document.getElementById('detail-type').textContent = selectedAlert.type_nom;
    document.getElementById('detail-type').style.color = selectedAlert.couleur;
    document.getElementById('detail-status').textContent = getStatusLabel(selectedAlert.status);
    document.getElementById('detail-status').className = `value alert-status ${selectedAlert.status}`;
    document.getElementById('detail-priority').textContent = `Priorite ${selectedAlert.priority}`;
    document.getElementById('detail-user').textContent = `${selectedAlert.nom} ${selectedAlert.prenom}`;
    document.getElementById('detail-telephone').textContent = selectedAlert.telephone;
    document.getElementById('detail-description').textContent = selectedAlert.description || 'Sans description';
    // Display quartier and avenue instead of GPS coordinates
    let locationText = '';
    if (selectedAlert.quartier) {
        locationText += selectedAlert.quartier;
    }
    if (selectedAlert.avenue) {
        locationText += locationText ? ', ' + selectedAlert.avenue : selectedAlert.avenue;
    }
    document.getElementById('detail-location').textContent = locationText || (selectedAlert.latitude && selectedAlert.longitude 
        ? `${selectedAlert.latitude.toFixed(5)}, ${selectedAlert.longitude.toFixed(5)}`
        : 'Non disponible');
    document.getElementById('detail-created').textContent = formatDate(selectedAlert.created_at);
    
    // Show photo if available
    const photoContainer = document.getElementById('alert-photo-container');
    const photoImg = document.getElementById('alert-photo');
    if (selectedAlert.photo) {
        photoContainer.classList.remove('hidden');
        photoImg.src = selectedAlert.photo;
    } else {
        photoContainer.classList.add('hidden');
    }
    
    // Show or hide route button
    const routeBtn = document.getElementById('btn-route');
    console.log('Selected alert:', selectedAlert);
    console.log('Latitude:', selectedAlert?.latitude, 'Longitude:', selectedAlert?.longitude);
    if (selectedAlert && selectedAlert.latitude && selectedAlert.longitude) {
        routeBtn.style.display = 'block';
    } else {
        routeBtn.style.display = 'none';
    }
    
    // Show panel and overlay
    document.getElementById('alert-details').classList.remove('hidden');
    document.getElementById('details-overlay').classList.remove('hidden');
    
    // Center map on alert
    if (selectedAlert.latitude && selectedAlert.longitude) {
        map.setView([selectedAlert.latitude, selectedAlert.longitude], 15);
    }
}

// Open Google Maps with directions
function openGoogleMapsRoute() {
    if (!selectedAlert || !selectedAlert.latitude || !selectedAlert.longitude) {
        showToast('Localisation non disponible', 'error');
        return;
    }
    
    const destLat = selectedAlert.latitude;
    const destLng = selectedAlert.longitude;
    
    // Open Google Maps in a new tab with directions
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    window.open(url, '_blank');
}

document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('alert-details').classList.add('hidden');
    document.getElementById('details-overlay').classList.add('hidden');
    selectedAlert = null;
});

// Route button click handler
document.getElementById('btn-route').addEventListener('click', openGoogleMapsRoute);

// Close modal when clicking overlay
document.getElementById('details-overlay').addEventListener('click', () => {
    document.getElementById('alert-details').classList.add('hidden');
    document.getElementById('details-overlay').classList.add('hidden');
    selectedAlert = null;
});

// Status update buttons
document.querySelectorAll('.btn-status').forEach(btn => {
    btn.addEventListener('click', async () => {
        if (!selectedAlert) return;
        
        const newStatus = btn.dataset.status;
        
        try {
            const token = localStorage.getItem('admin_token');
            const response = await fetch(`${API_URL}/api/alerts/${selectedAlert.id}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.status === 403 || response.status === 401) {
                localStorage.removeItem('admin_token');
                showSection('login-section');
                showToast('Session expiree, veuillez vous reconnecter', 'error');
                return;
            }
            
            if (response.ok) {
                showToast('Statut mis a jour', 'success');
                selectedAlert.status = newStatus;
                loadAlerts();
                loadStats();
                showAlertDetails(selectedAlert.id);
                stopAlertSound(); // Stop the alert sound when status is updated
            } else {
                showToast('Erreur de mise a jour', 'error');
            }
        } catch (error) {
            showToast('Erreur de connexion', 'error');
        }
    });
});

// Filters
document.getElementById('apply-filters').addEventListener('click', loadAlerts);

// =====================
// STATS
// =====================

async function loadStats() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        const stats = await response.json();
        console.log('Stats loaded:', stats);
        
        document.getElementById('stat-active').textContent = stats.active || 0;
        document.getElementById('stat-progress').textContent = stats.in_progress || 0;
        document.getElementById('stat-resolved').textContent = stats.resolved || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// =====================
// SOUND
// =====================

// Alert sound function using Web Speech API - says "Urgence" in loop
function startAlertSound() {
    if (!soundEnabled) return;
    
    stopAlertSound(); // Stop any existing sound first
    
    function playUrgenceVoice() {
        if (!soundEnabled) return;
        
        try {
            // Use Web Speech API for voice announcement
            if ('speechSynthesis' in window) {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance('Urgence, Urgence, Urgence');
                utterance.lang = 'fr-FR';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {
            console.log('Voice synthesis failed:', e);
        }
    }
    
    playUrgenceVoice();
    alertSoundInterval = setInterval(playUrgenceVoice, 4000); // Repeat every 4 seconds
}

function stopAlertSound() {
    if (alertSoundInterval) {
        clearInterval(alertSoundInterval);
        alertSoundInterval = null;
    }
    // Also stop any ongoing speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// Sound toggle button
document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    
    if (soundEnabled) {
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        btn.classList.remove('muted');
        showToast('Son active', 'success');
    } else {
        stopAlertSound();
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        btn.classList.add('muted');
        showToast('Son desactive', 'warning');
    }
});

function initSocket() {
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('Security center connected');
        socket.emit('join-room', 'security-center');
    });
    
    socket.on('new-alert', (alert) => {
        console.log('New alert received:', alert);
        startAlertSound(); // Play sound in loop
        showToast(`Nouvelle alerte: ${alert.type_nom}`, 'warning');
        loadAlerts();
        loadStats();
    });
    
    socket.on('alert-updated', (data) => {
        console.log('Alert updated:', data);
        loadAlerts();
        loadStats();
    });
    
    // Listen for reinforcement calls
    socket.on('reinforcement-call', (data) => {
        console.log('Reinforcement call received:', data);
        showReinforcementAlert(data);
    });
    
    // Listen for new chat messages
    socket.on('chat-message', (data) => {
        // Check if message is from current conversation
        if (currentChatUser && currentChatUser.id === data.sender_id) {
            // Add message to current conversation
            const messagesContainer = document.getElementById('admin-chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message received';
            
            // Handle voice messages
            let messageContent = data.message;
            if (data.audio_path) {
                messageContent = `<audio controls src="${data.audio_path}" class="voice-message"></audio>`;
            }
            
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p>${messageContent}</p>
                    <span class="message-time">${formatTime(data.created_at)}</span>
                </div>
                <button class="btn-delete-message" onclick="deleteAdminMessage(${data.id})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Show notification if message is from different user or panel is closed
        if (!currentChatUser || currentChatUser.id !== data.sender_id) {
            showChatNotification();
            // Also auto-open panel for new messages
            const panel = document.getElementById('admin-chat-panel');
            if (!panel.classList.contains('active')) {
                panel.classList.add('active');
                loadChatUsers();
            }
        }
        
        // Reload users list to show new message
        loadChatUsers();
    });
    
    // Listen for deleted messages
    socket.on('chat-message-deleted', (data) => {
        // Reload chat if open
        if (currentChatUser) {
            loadMessages(currentChatUser.id);
        }
        loadChatUsers();
    });
}

// =====================
// ADMIN CHAT FUNCTIONALITY
// =====================

let currentChatUser = null;
let chatUsers = [];

// Toggle chat panel
document.getElementById('btn-admin-chat').addEventListener('click', () => {
    const panel = document.getElementById('admin-chat-panel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
        loadChatUsers();
        // Clear badge when opening
        const badge = document.getElementById('chat-badge');
        badge.classList.add('hidden');
        badge.textContent = '0';
    }
});

// Close chat panel
document.getElementById('close-admin-chat').addEventListener('click', () => {
    document.getElementById('admin-chat-panel').classList.remove('active');
    currentChatUser = null;
});

// Show notification when new chat message arrives
function showChatNotification() {
    const panel = document.getElementById('admin-chat-panel');
    const badge = document.getElementById('chat-badge');
    
    // If panel is not open, show notification badge
    if (!panel.classList.contains('active')) {
        let count = parseInt(badge.textContent) || 0;
        count++;
        badge.textContent = count;
        badge.classList.remove('hidden');
    }
}

// Back to users list
document.getElementById('back-to-users').addEventListener('click', () => {
    currentChatUser = null;
    document.getElementById('chat-users-list').style.display = 'block';
    const conversationDiv = document.getElementById('chat-conversation');
    conversationDiv.style.display = 'none';
    conversationDiv.classList.add('hidden');
});

// Load chat users (users who have sent messages)
async function loadChatUsers() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/chat/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        if (response.ok) {
            chatUsers = await response.json();
            console.log('Chat users loaded:', chatUsers);
            renderChatUsers();
        } else {
            console.error('Error loading chat users:', response.status);
        }
    } catch (error) {
        console.error('Error loading chat users:', error);
    }
}

// Render chat users list
function renderChatUsers() {
    const container = document.getElementById('chat-users-list');
    container.innerHTML = '';
    
    if (chatUsers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Aucun message recu</p>';
        return;
    }
    
    chatUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-user-item';
        userDiv.innerHTML = `
            <div class="chat-user-avatar">${getInitials(user.nom || user.telephone)}</div>
            <div class="chat-user-info">
                <div class="chat-user-name">${user.nom || ''} ${user.prenom || ''} ${user.prenom ? '' : user.telephone}</div>
                <div class="chat-user-last-message">${user.last_message || 'Aucun message'}</div>
            </div>
        `;
        userDiv.addEventListener('click', () => {
            console.log('User clicked:', user);
            openConversation(user);
        });
        container.appendChild(userDiv);
    });
}

// Open conversation with user
async function openConversation(user) {
    console.log('Opening conversation for user:', user);
    currentChatUser = user;
    document.getElementById('chat-users-list').style.display = 'none';
    const conversationDiv = document.getElementById('chat-conversation');
    conversationDiv.classList.remove('hidden');
    conversationDiv.style.display = 'flex';
    document.getElementById('chat-user-name').textContent = `${user.nom || ''} ${user.prenom || ''} ${user.prenom ? '' : user.telephone}`;
    
    await loadMessages(user.id);
}

// Load messages for a specific user
async function loadMessages(userId) {
    try {
        const token = localStorage.getItem('admin_token');
        console.log('Loading messages for user:', userId);
        const response = await fetch(`${API_URL}/api/chat/messages/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        console.log('Response status:', response.status);
        if (response.ok) {
            const messages = await response.json();
            console.log('Messages:', messages);
            renderMessages(messages);
        } else {
            const error = await response.json();
            console.error('Error:', error);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Render messages
function renderMessages(messages) {
    console.log('Rendering messages:', messages);
    const container = document.getElementById('admin-chat-messages');
    container.innerHTML = '';
    
    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Aucun message</p>';
        return;
    }
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = msg.sender_type === 'admin' ? 'message sent' : 'message received';
        messageDiv.setAttribute('data-id', msg.id);
        
        // Check if this is a voice message
        let messageContent = msg.message;
        if (msg.audio_path) {
            messageContent = `<audio controls src="${msg.audio_path}" class="voice-message"></audio>`;
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${messageContent}</p>
                <span class="message-time">${formatTime(msg.created_at)}</span>
            </div>
            <button class="btn-delete-message" onclick="deleteAdminMessage(${msg.id})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(messageDiv);
    });
    
    container.scrollTop = container.scrollHeight;
}

// Delete message (admin)
async function deleteAdminMessage(messageId) {
    if (!confirm('Voulez-vous vraiment supprimer ce message?')) return;
    
    // Optimistic update - remove from UI immediately
    const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/chat/admin/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        if (response.ok) {
            showToast('Message supprimé', 'success');
        } else {
            // If API fails, reload to restore state
            const error = await response.json();
            showToast(error.error || 'Erreur de suppression', 'error');
            if (currentChatUser) {
                loadMessages(currentChatUser.id);
            }
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Erreur de connexion', 'error');
        // Reload to restore state on error
        if (currentChatUser) {
            loadMessages(currentChatUser.id);
        }
    }
}

// Make deleteAdminMessage available globally
window.deleteAdminMessage = deleteAdminMessage;

// Send message
document.getElementById('admin-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentChatUser) return;
    
    const input = document.getElementById('admin-chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/chat/admin/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                user_id: currentChatUser.id,
                message: message
            })
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        if (response.ok) {
            input.value = '';
            // Add message to UI immediately
            const messagesContainer = document.getElementById('admin-chat-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message sent';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p>${message}</p>
                    <span class="message-time">${formatTime(new Date().toISOString())}</span>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Erreur d\'envoi du message', 'error');
    }
});

// Voice Recording for Security Center Admin
let adminMediaRecorder = null;
let adminAudioChunks = [];
let adminIsRecording = false;

async function initAdminVoiceRecording() {
    const voiceBtn = document.getElementById('btn-voice-admin');
    if (!voiceBtn) return;
    
    voiceBtn.addEventListener('click', async () => {
        if (!adminIsRecording) {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Use webm by default (most widely supported)
                const mimeType = 'audio/webm';
                
                adminMediaRecorder = new MediaRecorder(stream, { mimeType });
                adminAudioChunks = [];
                
                adminMediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        adminAudioChunks.push(event.data);
                    }
                };
                
                adminMediaRecorder.onstop = async () => {
                    if (adminAudioChunks.length === 0) {
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }
                    
                    const audioBlob = new Blob(adminAudioChunks, { type: mimeType });
                    await sendAdminVoiceMessage(audioBlob, 'webm');
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };
                
                adminMediaRecorder.start(1000); // Collect data every second
                adminIsRecording = true;
                voiceBtn.classList.add('recording');
                showToast('Enregistrement en cours...', 'info');
            } catch (error) {
                console.error('Error accessing microphone:', error);
                showToast('Erreur d\'accès au microphone', 'error');
            }
        } else {
            // Stop recording
            if (adminMediaRecorder && adminMediaRecorder.state !== 'inactive') {
                adminMediaRecorder.stop();
            }
            adminIsRecording = false;
            voiceBtn.classList.remove('recording');
        }
    });
}

async function sendAdminVoiceMessage(audioBlob, extension = 'webm') {
    if (!currentChatUser) {
        showToast('Sélectionnez un utilisateur pour envoyer un message vocal', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('admin_token');
        const formData = new FormData();
        formData.append('audio', audioBlob, `voice.${extension}`);
        formData.append('user_id', currentChatUser.id);
        
        console.log('Sending admin voice message, blob size:', audioBlob.size);
        
        const response = await fetch(`${API_URL}/api/chat/admin/voice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        console.log('Admin voice response status:', response.status);
        
        if (response.ok) {
            showToast('Message vocal envoyé', 'success');
            loadMessages(currentChatUser.id);
        } else {
            const error = await response.json();
            showToast('Erreur: ' + (error.error || 'Erreur d\'envoi du message vocal'), 'error');
        }
    } catch (error) {
        console.error('Error sending voice message:', error);
        showToast('Erreur de connexion', 'error');
    }
}

// Initialize admin voice recording when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAdminVoiceRecording, 1000);
});

// Helper functions
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// =====================
// EXPORT FUNCTIONS
// =====================

document.getElementById('export-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Colors
    const primaryColor = [26, 26, 46]; // Dark blue
    const accentColor = [255, 107, 107]; // Red accent
    const lightGray = [240, 240, 240];
    
    // Header with logo
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 300, 35, 'F');
    
    // Logo icon (shield with GS text)
    doc.setFillColor(...accentColor);
    // Shield shape
    doc.moveTo(15, 8);
    doc.lineTo(35, 8);
    doc.lineTo(35, 22);
    doc.lineTo(25, 28);
    doc.lineTo(15, 22);
    doc.lineTo(15, 8);
    doc.fill();
    // GS text inside shield
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('GS', 21, 18);
    
    // Title
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('CENTRE DE SECURITE DE GOMA', 45, 15);
    doc.setFontSize(12);
    doc.text('Rapport des Alertes', 45, 23);
    
    // Date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    doc.setFontSize(10);
    doc.text(`Genere le: ${dateStr} a ${timeStr}`, 45, 30);
    
    // Statistics summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFillColor(...lightGray);
    doc.rect(15, 42, 270, 12, 'F');
    doc.text(`Total des alertes: ${alerts.length} | Actives: ${alerts.filter(a => a.status === 'active').length} | En cours: ${alerts.filter(a => a.status === 'en_cours').length} | Resolues: ${alerts.filter(a => a.status === 'resolu').length}`, 20, 50);
    
    // Table setup
    const headers = ['#', 'Type', 'Statut', 'Priorite', 'Citoyen', 'Telephone', 'Quartier', 'Avenue', 'Date'];
    const colWidths = [10, 35, 25, 20, 40, 30, 35, 35, 30];
    const startX = 15;
    let y = 60;
    
    // Draw table header
    doc.setFillColor(...primaryColor);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    
    let x = startX;
    headers.forEach((header, i) => {
        doc.rect(x, y, colWidths[i], 8, 'F');
        doc.text(header, x + 2, y + 5.5);
        x += colWidths[i];
    });
    
    y += 8;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    
    // Draw table rows
    alerts.forEach((alert, index) => {
        if (y > 185) {
            doc.addPage();
            y = 20;
            
            // Redraw header on new page
            doc.setFillColor(...primaryColor);
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            
            x = startX;
            headers.forEach((header, i) => {
                doc.rect(x, y, colWidths[i], 8, 'F');
                doc.text(header, x + 2, y + 5.5);
                x += colWidths[i];
            });
            
            y += 8;
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
            doc.setFillColor(...lightGray);
            doc.rect(startX, y, 270, 7, 'F');
        }
        
        // Row data
        const rowData = [
            (index + 1).toString(),
            alert.type_nom || '',
            getStatusLabel(alert.status),
            `P${alert.priority}`,
            `${alert.nom} ${alert.prenom}`,
            alert.telephone || '',
            alert.quartier || 'N/A',
            alert.avenue || 'N/A',
            formatDate(alert.created_at)
        ];
        
        x = startX;
        doc.setFontSize(8);
        rowData.forEach((data, i) => {
            // Truncate text if too long
            let text = data.toString();
            if (text.length > 15) {
                text = text.substring(0, 12) + '...';
            }
            doc.text(text, x + 2, y + 5);
            x += colWidths[i];
        });
        
        y += 7;
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} sur ${pageCount}`, 260, 200);
        doc.text('Centre de Securite de Goma - Republique Democratique du Congo', 15, 200);
    }
    
    doc.save('rapport-alertes-goma-security.pdf');
    showToast('PDF exporte avec succes', 'success');
});

document.getElementById('export-excel').addEventListener('click', () => {
    const data = alerts.map(a => ({
        Type: a.type_nom,
        Statut: getStatusLabel(a.status),
        Priorite: `P${a.priority}`,
        Nom: `${a.nom} ${a.prenom}`,
        Telephone: a.telephone,
        Quartier: a.quartier || 'N/A',
        Avenue: a.avenue || 'N/A',
        Description: a.description || '',
        Date: formatDate(a.created_at)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alertes');
    XLSX.writeFile(wb, 'alertes-goma-security.xlsx');
    showToast('Excel exporte avec succes', 'success');
});

document.getElementById('export-json').addEventListener('click', () => {
    const dataStr = JSON.stringify(alerts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alertes.json';
    a.click();
    showToast('JSON exporte', 'success');
});

document.getElementById('export-csv').addEventListener('click', () => {
    const headers = ['Type', 'Statut', 'Priorite', 'Nom', 'Telephone', 'Quartier', 'Avenue', 'Description', 'Date'];
    const rows = alerts.map(a => [
        a.type_nom,
        getStatusLabel(a.status),
        `P${a.priority}`,
        `${a.nom} ${a.prenom}`,
        a.telephone,
        a.quartier || 'N/A',
        a.avenue || 'N/A',
        a.description || '',
        formatDate(a.created_at)
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alertes-goma-security.csv';
    a.click();
    showToast('CSV exporte avec succes', 'success');
});

document.getElementById('print-report').addEventListener('click', () => {
    window.print();
});

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

function getPosteLabel(poste) {
    const labels = {
        'poste1': 'Police',
        'poste2': 'Pompiers',
        'poste3': 'Ambulance',
        'poste4': 'Protection civile',
        'poste5': 'Gendarmerie',
        'poste6': 'Intelligence',
        'poste7': 'Administration',
        'poste8': 'Urgence majeurs'
    };
    return labels[poste] || poste;
}

// Map emergency types to appropriate postes
const emergencyToPoste = {
    'Agression': 'poste1',         // Police
    'Accident': 'poste1',          // Police
    'Incendie': 'poste2',          // Pompiers
    'Urgence Medicale': 'poste3',  // Ambulance
    'Violence': 'poste5',          // Gendarmerie
    'Activite Suspecte': 'poste6', // Intelligence
    'Manifestation': 'poste1',      // Police
    'Catastrophe Naturelle': 'poste4' // Protection civile
};

// Get appropriate poste for emergency type
function getPosteForEmergency(typeNom) {
    return emergencyToPoste[typeNom] || 'poste1';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Show reinforcement call alert
function showReinforcementAlert(data) {
    // Play sound
    startAlertSound();
    
    // Show toast message
    showToast(`RENFORT URGENCE - ${data.posteName} demande des renforts!`, 'warning');
    
    // Add to alerts sidebar as a special alert
    const container = document.getElementById('sidebar-alerts');
    const reinforcementElement = document.createElement('div');
    reinforcementElement.className = 'alert-item status-active reinforcement-alert';
    reinforcementElement.id = `reinforcement-${Date.now()}`;
    reinforcementElement.innerHTML = `
        <div class="alert-item-header">
            <div class="alert-item-type">
                <i class="fas fa-bullhorn" style="background: #e74c3c"></i>
                <span>RENFORT URGENCE</span>
            </div>
            <span class="alert-item-status active">URGENT</span>
        </div>
        <div class="alert-item-meta">
            ${data.posteName} - ${formatDate(data.timestamp)}
        </div>
        <div class="alert-item-actions">
            <button class="btn-delete-reinforcement" data-id="${reinforcementElement.id}" title="Supprimer">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        </div>
    `;
    
    // Add delete handler
    reinforcementElement.querySelector('.btn-delete-reinforcement').addEventListener('click', (e) => {
        e.stopPropagation();
        reinforcementElement.remove();
        showToast('Alerte de reinforcement supprimee', 'success');
    });
    
    // Add at the top of the list
    container.insertBefore(reinforcementElement, container.firstChild);
}

// Show photo modal
function showPhotoModal(photoUrl) {
    const modal = document.getElementById('photo-modal');
    const img = document.getElementById('modal-photo');
    img.src = photoUrl;
    modal.classList.remove('hidden');
}

// Close photo modal
document.getElementById('close-photo-modal').addEventListener('click', () => {
    document.getElementById('photo-modal').classList.add('hidden');
});

document.getElementById('photo-modal').addEventListener('click', (e) => {
    if (e.target.id === 'photo-modal') {
        document.getElementById('photo-modal').classList.add('hidden');
    }
});

// Auto-assign alert to appropriate poste based on emergency type
async function assignAlertDirectly(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;
    
    // Get appropriate poste for this emergency type
    const poste = getPosteForEmergency(alert.type_nom);
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/alerts/${alertId}/assign`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ assigned_to: poste })
        });
        
        if (response.status === 403 || response.status === 401) {
            localStorage.removeItem('admin_token');
            showSection('login-section');
            showToast('Session expiree, veuillez vous reconnecter', 'error');
            return;
        }
        
        if (response.ok) {
            showToast(`Alerte assignee a ${getPosteLabel(poste)}`, 'success');
            loadAlerts();
            loadStats();
        } else {
            showToast('Erreur d\'assignation', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// Show assign modal (disabled - using direct assignment instead)
function showAssignModal(alertId) {
    // Direct assignment without modal
    assignAlertDirectly(alertId);
}

// Close assign modal (not used anymore - direct assignment)
document.querySelector('[data-modal="assign-modal"]').addEventListener('click', () => {
    // Modal is no longer used
});

// Handle poste button clicks (not used anymore - direct assignment)
document.querySelectorAll('.poste-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        // No longer used
    });
});

// =====================
// INITIALIZE
// =====================

document.addEventListener('DOMContentLoaded', checkAuth);
