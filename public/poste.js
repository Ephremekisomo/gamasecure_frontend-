/**
 * Goma Security - Poste Interface JavaScript
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
let selectedPoste = null;
let alerts = [];
let selectedAlert = null;
let soundEnabled = true;
let reinforcementSoundInterval = null;
let socket = null;

const posteNames = {
    'poste1': 'Police',
    'poste2': 'Pompiers',
    'poste3': 'Ambulance',
    'poste4': 'Protection civile',
    'poste5': 'Gendarmerie',
    'poste6': 'Intelligence',
    'poste7': 'Administration',
    'poste8': 'Urgence majeurs'
};

const posteEmergencyTypes = {
    'poste1': ['Agression', 'Activite suspecte', 'Violence'],
    'poste2': ['Incendie', 'Catastrophe naturelle'],
    'poste3': ['Urgence medicale', 'Accident'],
    'poste4': ['Catastrophe naturelle', 'Manifestation'],
    'poste5': ['Agression', 'Manifestation', 'Violence'],
    'poste6': ['Activite suspecte', 'Manifestation'],
    'poste7': ['Manifestation', 'Catastrophe naturelle'],
    'poste8': ['Agression', 'Accident', 'Incendie', 'Urgence medicale', 'Catastrophe naturelle']
};

// =====================
// AUTHENTICATION
// =====================

function checkAuth() {
    const token = localStorage.getItem('poste_token');
    if (token) {
        // Check if this is a token from citizen interface login
        try {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            if (tokenData.role === 'poste' && tokenData.poste) {
                // Token from citizen interface - extract poste info
                selectedPoste = tokenData.poste;
                localStorage.setItem('poste_name', posteNames[tokenData.poste] || 'Poste');
            }
        } catch (e) {
            // Token from direct poste login - already has poste info
        }
        showDashboard();
        initApp();
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const posteName = document.getElementById('login-poste').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Find the poste ID based on the name entered
    let matchedPosteId = null;
    let displayName = posteName;
    
    // First try exact match (case insensitive)
    for (const [posteId, name] of Object.entries(posteNames)) {
        if (name.toLowerCase() === posteName.toLowerCase()) {
            matchedPosteId = posteId;
            displayName = name;
            break;
        }
    }
    
    // If no exact match, check if the entered name contains the poste name
    if (!matchedPosteId) {
        for (const [posteId, name] of Object.entries(posteNames)) {
            if (name.toLowerCase().includes(posteName.toLowerCase()) || 
                posteName.toLowerCase().includes(name.toLowerCase())) {
                matchedPosteId = posteId;
                displayName = name;
                break;
            }
        }
    }
    
    if (!matchedPosteId) {
        showToast('Poste non reconnu. Ex: Police, Pompiers, Ambulance...', 'error');
        return;
    }
    
    // Simple password check - password should match the poste name
    if (password === 'poste123') {
        selectedPoste = matchedPosteId;
        const token = btoa(JSON.stringify({ poste: matchedPosteId, role: 'poste' }));
        localStorage.setItem('poste_token', token);
        localStorage.setItem('poste_name', displayName);
        showDashboard();
        initApp();
    } else {
        showToast('Mot de passe incorrect', 'error');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('poste_token');
    localStorage.removeItem('poste_name');
    localStorage.removeItem('token');
    localStorage.removeItem('admin_token');
    currentUser = null;
    selectedPoste = null;
    showSection('login-section');
    showToast('Deconnexion reussie', 'success');
});

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
}

function showDashboard() {
    showSection('dashboard-section');
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('poste-name').textContent = localStorage.getItem('poste_name') || 'Poste';
}

// =====================
// APP INITIALIZATION
// =====================

async function initApp() {
    await loadAlerts();
    await loadStats();
    initSocket();
}

// =====================
// ALERTS
// =====================

async function loadAlerts() {
    const token = localStorage.getItem('poste_token');
    if (!token) {
        alerts = [];
        renderAlerts();
        return;
    }
    
    const posteData = JSON.parse(atob(token));
    const poste = posteData.poste;
    
    try {
        // Use the new endpoint to get alerts for this specific poste
        const response = await fetch(`${API_URL}/api/alerts/poste/${poste}`);
        
        if (response.ok) {
            alerts = await response.json();
        } else {
            alerts = [];
        }
        
        renderAlerts();
    } catch (error) {
        // Fallback: show empty list
        alerts = [];
        renderAlerts();
    }
}

async function fetchAlertsForPoste(poste) {
    // This would normally call an API endpoint
    // For now, return empty array
    return [];
}

function renderAlerts() {
    const container = document.getElementById('alerts-list');
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>Aucune alerte pour ce poste</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-card status-${alert.status}" data-id="${alert.id}">
            <div class="alert-header">
                <div class="alert-type">
                    <i class="fas ${alert.icone}" style="background: ${alert.couleur}"></i>
                    <span>${alert.type_nom}</span>
                </div>
                <span class="alert-status ${alert.status}">${getStatusLabel(alert.status)}</span>
            </div>
            <p class="alert-description">${alert.description || 'Sans description'}</p>
            <div class="alert-meta">
                <span>${alert.nom} ${alert.prenom}</span>
                <span>${formatDate(alert.created_at)}</span>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.alert-card').forEach(card => {
        card.addEventListener('click', () => {
            const alertId = parseInt(card.dataset.id);
            showAlertDetails(alertId);
        });
    });
}

function showAlertDetails(alertId) {
    selectedAlert = alerts.find(a => a.id === alertId);
    if (!selectedAlert) return;
    
    document.getElementById('detail-type').textContent = selectedAlert.type_nom;
    document.getElementById('detail-type').style.color = selectedAlert.couleur;
    document.getElementById('detail-status').textContent = getStatusLabel(selectedAlert.status);
    document.getElementById('detail-status').className = `value alert-status ${selectedAlert.status}`;
    document.getElementById('detail-user').textContent = `${selectedAlert.nom} ${selectedAlert.prenom}`;
    document.getElementById('detail-telephone').textContent = selectedAlert.telephone;
    document.getElementById('detail-description').textContent = selectedAlert.description || 'Sans description';
    document.getElementById('detail-location').textContent = selectedAlert.latitude && selectedAlert.longitude 
        ? `${selectedAlert.latitude.toFixed(5)}, ${selectedAlert.longitude.toFixed(5)}`
        : 'Non disponible';
    document.getElementById('detail-created').textContent = formatDate(selectedAlert.created_at);
    
    // Store coordinates for tracking
    selectedAlert.coords = {
        lat: selectedAlert.latitude,
        lng: selectedAlert.longitude
    };
    
    document.getElementById('alert-details').classList.remove('hidden');
}

document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('alert-details').classList.add('hidden');
    selectedAlert = null;
});

// Track button - opens Google Maps
document.getElementById('btn-track').addEventListener('click', () => {
    if (!selectedAlert || !selectedAlert.latitude || !selectedAlert.longitude) {
        showToast('Localisation non disponible', 'error');
        return;
    }
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedAlert.latitude},${selectedAlert.longitude}`;
    window.open(url, '_blank');
});

// Status update buttons
document.querySelectorAll('.btn-status').forEach(btn => {
    btn.addEventListener('click', async () => {
        if (!selectedAlert) return;
        
        const newStatus = btn.dataset.status;
        
        try {
            const adminToken = localStorage.getItem('admin_token');
            if (!adminToken) {
                showToast('Session expiree,veuillezvous reconnecter au centre de securite', 'error');
                return;
            }
            
            const response = await fetch(`${API_URL}/api/alerts/${selectedAlert.id}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                showToast('Statut mis a jour', 'success');
                selectedAlert.status = newStatus;
                loadAlerts();
                loadStats();
                showAlertDetails(selectedAlert.id);
            } else {
                showToast('Erreur de mise a jour', 'error');
            }
        } catch (error) {
            showToast('Erreur de connexion', 'error');
        }
    });
});

// =====================
// STATS
// =====================

async function loadStats() {
    const pending = alerts.filter(a => a.status === 'active').length;
    const progress = alerts.filter(a => a.status === 'en_cours').length;
    const resolved = alerts.filter(a => a.status === 'resolu').length;
    
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-progress').textContent = progress;
    document.getElementById('stat-resolved').textContent = resolved;
}

// =====================
// SOCKET
// =====================

function initSocket() {
    socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('Poste connected');
    });
    
    socket.on('new-alert', (data) => {
        // New alert created - reload to check if assigned to this poste
        loadAlerts();
        loadStats();
    });
    
    socket.on('alert-updated', (data) => {
        loadAlerts();
        loadStats();
    });
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
        'active': 'En attente',
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
// REINFORCEMENT CALL
// =====================

function playReinforcementSound() {
    if (!soundEnabled) return;
    
    stopReinforcementSound();
    
    function playVoice() {
        if (!soundEnabled) return;
        
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                
                const posteName = localStorage.getItem('poste_name') || 'Poste';
                const utterance = new SpeechSynthesisUtterance(`Renfort Urgence, ${posteName}, Urgence, Urgence`);
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
    
    playVoice();
    reinforcementSoundInterval = setInterval(playVoice, 4000);
}

function stopReinforcementSound() {
    if (reinforcementSoundInterval) {
        clearInterval(reinforcementSoundInterval);
        reinforcementSoundInterval = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// Call reinforcement button
document.getElementById('btn-call-reinforcement').addEventListener('click', async () => {
    const posteName = localStorage.getItem('poste_name') || 'Poste';
    
    // Send to security center via socket (they will play the sound)
    if (socket) {
        socket.emit('reinforcement-call', {
            poste: selectedPoste,
            posteName: posteName,
            timestamp: new Date().toISOString()
        });
    }
    
    showToast('Renfort demande! Le centre de securite va etre notifie.', 'warning');
});

// Sound toggle button
document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    
    if (soundEnabled) {
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        btn.classList.remove('muted');
    } else {
        stopReinforcementSound();
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        btn.classList.add('muted');
    }
});

// =====================
// INITIALIZE
// =====================

document.addEventListener('DOMContentLoaded', checkAuth);
