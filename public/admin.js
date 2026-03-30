/**
 * Goma Security - Admin Panel JavaScript
 */

// =====================
// CONFIGURATION
// =====================

const API_URL = 'https://gomasecure-backend.onrender.com';
const SOCKET_URL = 'https://gomasecure-backend.onrender.com';

// =====================
// STATE
// =====================

let currentUser = null;
let socket = null;
let alerts = [];
let users = [];
let chatUsers = [];
let currentChatUser = null;
let stats = {};

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
    });
    document.getElementById(sectionId).classList.add('active');
}

function showDashboard() {
    showSection('dashboard-section');
}

// =====================
// SIDEBAR NAVIGATION
// =====================

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const section = item.dataset.section;
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show corresponding section
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');
        
        // Update page title
        const titles = {
            'dashboard': 'Tableau de bord',
            'alerts': 'Gestion des Alertes',
            'users': 'Gestion des Utilisateurs',
            'chat': 'Messages',
            'posts': 'Gestion des Postes',
            'emergency-types': 'Types d\'urgence',
            'system': 'Systeme',
            'settings': 'Parametres'
        };
        document.getElementById('page-title').textContent = titles[section] || 'Administration';
        
        // Load section data
        loadSectionData(section);
    });
});

// Toggle sidebar
document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
});

// Refresh button
document.getElementById('btn-refresh').addEventListener('click', () => {
    loadSectionData(document.querySelector('.nav-item.active').dataset.section);
    showToast('Donnees rafraichies', 'success');
});

// =====================
// APP INITIALIZATION
// =====================

async function initApp() {
    await loadStats();
    await loadAlerts();
    await loadUsers();
    await loadChatUsers();
    initSocket();
    loadSystemInfo();
}

async function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            await loadStats();
            await loadAlerts();
            renderDashboard();
            break;
        case 'alerts':
            await loadAlerts();
            renderAlertsTable();
            break;
        case 'users':
            await loadUsers();
            renderUsersTable();
            break;
        case 'chat':
            await loadChatUsers();
            renderChatUsers();
            break;
        case 'posts':
            renderPosts();
            break;
        case 'emergency-types':
            await loadEmergencyTypes();
            renderEmergencyTypes();
            break;
        case 'system':
            loadSystemInfo();
            break;
    }
}

// =====================
// STATISTICS
// =====================

async function loadStats() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            stats = await response.json();
            updateStatsDisplay();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStatsDisplay() {
    document.getElementById('stat-active').textContent = stats.active || 0;
    document.getElementById('stat-progress').textContent = stats.in_progress || 0;
    document.getElementById('stat-resolved').textContent = stats.resolved || 0;
    document.getElementById('total-users').textContent = users.length || 0;
    document.getElementById('total-alerts').textContent = stats.total || 0;
    document.getElementById('total-resolved').textContent = stats.resolved || 0;
    document.getElementById('total-messages').textContent = chatUsers.reduce((sum, u) => sum + (u.message_count || 0), 0);
}

// =====================
// ALERTS
// =====================

async function loadAlerts() {
    try {
        const token = localStorage.getItem('admin_token');
        const status = document.getElementById('filter-alert-status').value;
        const priority = document.getElementById('filter-alert-priority').value;
        
        let url = `${API_URL}/api/alerts?`;
        if (status) url += `status=${status}&`;
        if (priority) url += `priority=${priority}&`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alerts = await response.json();
        }
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

function renderAlertsTable() {
    const tbody = document.getElementById('alerts-tbody');
    
    if (alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Aucune alerte</td></tr>';
        return;
    }
    
    tbody.innerHTML = alerts.map(alert => `
        <tr>
            <td>#${alert.id}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${alert.icone}" style="color: ${alert.couleur}"></i>
                    ${alert.type_nom}
                </div>
            </td>
            <td>${alert.nom} ${alert.prenom}</td>
            <td><span class="status-badge ${alert.status}">${getStatusLabel(alert.status)}</span></td>
            <td><span class="priority-badge p${alert.priority}">P${alert.priority}</span></td>
            <td>${formatDate(alert.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action view" onclick="viewAlert(${alert.id})" title="Voir">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action edit" onclick="editAlert(${alert.id})" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteAlert(${alert.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

document.getElementById('btn-filter-alerts').addEventListener('click', async () => {
    await loadAlerts();
    renderAlertsTable();
});

async function viewAlert(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div class="alert-details">
            <div class="detail-row">
                <span class="label">Type:</span>
                <span class="value" style="color: ${alert.couleur}">${alert.type_nom}</span>
            </div>
            <div class="detail-row">
                <span class="label">Statut:</span>
                <span class="value"><span class="status-badge ${alert.status}">${getStatusLabel(alert.status)}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">Priorite:</span>
                <span class="value"><span class="priority-badge p${alert.priority}">P${alert.priority}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">Citoyen:</span>
                <span class="value">${alert.nom} ${alert.prenom}</span>
            </div>
            <div class="detail-row">
                <span class="label">Telephone:</span>
                <span class="value">${alert.telephone}</span>
            </div>
            <div class="detail-row">
                <span class="label">Description:</span>
                <span class="value">${alert.description || 'Sans description'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Localisation:</span>
                <span class="value">${alert.quartier || 'Non specifie'}${alert.avenue ? ', ' + alert.avenue : ''}</span>
            </div>
            <div class="detail-row">
                <span class="label">Date:</span>
                <span class="value">${formatDate(alert.created_at)}</span>
            </div>
            ${alert.photo ? `
            <div class="detail-row">
                <span class="label">Photo:</span>
                <span class="value"><img src="${alert.photo}" alt="Photo" style="max-width: 200px; border-radius: 8px;"></span>
            </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('modal-title').textContent = `Alerte #${alert.id}`;
    document.getElementById('modal').classList.remove('hidden');
}

async function editAlert(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="edit-alert-form">
            <div class="form-group">
                <label>Statut</label>
                <select id="edit-alert-status">
                    <option value="active" ${alert.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="en_cours" ${alert.status === 'en_cours' ? 'selected' : ''}>En cours</option>
                    <option value="resolu" ${alert.status === 'resolu' ? 'selected' : ''}>Resolu</option>
                </select>
            </div>
            <div class="form-group">
                <label>Priorite</label>
                <select id="edit-alert-priority">
                    <option value="1" ${alert.priority === 1 ? 'selected' : ''}>Urgence (1)</option>
                    <option value="2" ${alert.priority === 2 ? 'selected' : ''}>Haute (2)</option>
                    <option value="3" ${alert.priority === 3 ? 'selected' : ''}>Moyenne (3)</option>
                    <option value="4" ${alert.priority === 4 ? 'selected' : ''}>Basse (4)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Assigner a</label>
                <select id="edit-alert-assigned">
                    <option value="">Non assigne</option>
                    <option value="poste1" ${alert.assigned_to === 'poste1' ? 'selected' : ''}>Police</option>
                    <option value="poste2" ${alert.assigned_to === 'poste2' ? 'selected' : ''}>Pompiers</option>
                    <option value="poste3" ${alert.assigned_to === 'poste3' ? 'selected' : ''}>Ambulance</option>
                    <option value="poste4" ${alert.assigned_to === 'poste4' ? 'selected' : ''}>Protection civile</option>
                    <option value="poste5" ${alert.assigned_to === 'poste5' ? 'selected' : ''}>Gendarmerie</option>
                    <option value="poste6" ${alert.assigned_to === 'poste6' ? 'selected' : ''}>Intelligence</option>
                    <option value="poste7" ${alert.assigned_to === 'poste7' ? 'selected' : ''}>Administration</option>
                    <option value="poste8" ${alert.assigned_to === 'poste8' ? 'selected' : ''}>Urgence majeurs</option>
                </select>
            </div>
            <button type="submit" class="btn-primary">
                <i class="fas fa-save"></i> Enregistrer
            </button>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = `Modifier Alert #${alert.id}`;
    document.getElementById('modal').classList.remove('hidden');
    
    document.getElementById('edit-alert-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const status = document.getElementById('edit-alert-status').value;
        const priority = document.getElementById('edit-alert-priority').value;
        const assigned_to = document.getElementById('edit-alert-assigned').value;
        
        try {
            const token = localStorage.getItem('admin_token');
            
            // Update status
            if (status !== alert.status) {
                await fetch(`${API_URL}/api/alerts/${alertId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status })
                });
            }
            
            // Update assignment
            if (assigned_to !== alert.assigned_to) {
                await fetch(`${API_URL}/api/alerts/${alertId}/assign`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ assigned_to })
                });
            }
            
            showToast('Alerte mise a jour', 'success');
            document.getElementById('modal').classList.add('hidden');
            await loadAlerts();
            renderAlertsTable();
        } catch (error) {
            showToast('Erreur de mise a jour', 'error');
        }
    });
}

async function deleteAlert(alertId) {
    if (!confirm('Voulez-vous vraiment supprimer cette alerte?')) return;
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            showToast('Alerte supprimee', 'success');
            await loadAlerts();
            renderAlertsTable();
        } else {
            showToast('Erreur de suppression', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// =====================
// USERS
// =====================

async function loadUsers() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            users = await response.json();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Aucun utilisateur</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>#${user.id}</td>
            <td>${user.nom} ${user.prenom}</td>
            <td>${user.telephone}</td>
            <td>${user.email || '-'}</td>
            <td><span class="status-badge ${user.role}">${user.role}</span></td>
            <td>${user.quartier || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action view" onclick="viewUser(${user.id})" title="Voir">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action edit" onclick="editUser(${user.id})" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteUser(${user.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

document.getElementById('search-users').addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = users.filter(u => 
        u.nom.toLowerCase().includes(search) ||
        u.prenom.toLowerCase().includes(search) ||
        u.telephone.includes(search)
    );
    renderFilteredUsers(filtered);
});

function renderFilteredUsers(filteredUsers) {
    const tbody = document.getElementById('users-tbody');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Aucun resultat</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => `
        <tr>
            <td>#${user.id}</td>
            <td>${user.nom} ${user.prenom}</td>
            <td>${user.telephone}</td>
            <td>${user.email || '-'}</td>
            <td><span class="status-badge ${user.role}">${user.role}</span></td>
            <td>${user.quartier || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action view" onclick="viewUser(${user.id})" title="Voir">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action edit" onclick="editUser(${user.id})" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteUser(${user.id})" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function viewUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div class="user-details">
            <div class="detail-row">
                <span class="label">Nom:</span>
                <span class="value">${user.nom} ${user.prenom}</span>
            </div>
            <div class="detail-row">
                <span class="label">Telephone:</span>
                <span class="value">${user.telephone}</span>
            </div>
            <div class="detail-row">
                <span class="label">Email:</span>
                <span class="value">${user.email || '-'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Role:</span>
                <span class="value"><span class="status-badge ${user.role}">${user.role}</span></span>
            </div>
            <div class="detail-row">
                <span class="label">Quartier:</span>
                <span class="value">${user.quartier || '-'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Avenue:</span>
                <span class="value">${user.avenue || '-'}</span>
            </div>
            <div class="detail-row">
                <span class="label">2FA:</span>
                <span class="value">${user.two_fa_enabled ? 'Active' : 'Desactive'}</span>
            </div>
            <div class="detail-row">
                <span class="label">Inscrit le:</span>
                <span class="value">${formatDate(user.created_at)}</span>
            </div>
        </div>
    `;
    
    document.getElementById('modal-title').textContent = `Utilisateur #${user.id}`;
    document.getElementById('modal').classList.remove('hidden');
}

async function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="edit-user-form">
            <div class="form-group">
                <label>Nom</label>
                <input type="text" id="edit-user-nom" value="${user.nom}" required>
            </div>
            <div class="form-group">
                <label>Prenom</label>
                <input type="text" id="edit-user-prenom" value="${user.prenom}" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="edit-user-email" value="${user.email || ''}">
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="edit-user-role">
                    <option value="citoyen" ${user.role === 'citoyen' ? 'selected' : ''}>Citoyen</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>Quartier</label>
                <input type="text" id="edit-user-quartier" value="${user.quartier || ''}">
            </div>
            <button type="submit" class="btn-primary">
                <i class="fas fa-save"></i> Enregistrer
            </button>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = `Modifier Utilisateur #${user.id}`;
    document.getElementById('modal').classList.remove('hidden');
    
    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nom = document.getElementById('edit-user-nom').value;
        const prenom = document.getElementById('edit-user-prenom').value;
        const email = document.getElementById('edit-user-email').value;
        const role = document.getElementById('edit-user-role').value;
        const quartier = document.getElementById('edit-user-quartier').value;
        
        try {
            const token = localStorage.getItem('admin_token');
            const response = await fetch(`${API_URL}/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nom, prenom, email, role, quartier })
            });
            
            if (response.ok) {
                showToast('Utilisateur mis a jour', 'success');
                document.getElementById('modal').classList.add('hidden');
                await loadUsers();
                renderUsersTable();
            } else {
                showToast('Erreur de mise a jour', 'error');
            }
        } catch (error) {
            showToast('Erreur de connexion', 'error');
        }
    });
}

async function deleteUser(userId) {
    if (!confirm('Voulez-vous vraiment supprimer cet utilisateur?')) return;
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            showToast('Utilisateur supprime', 'success');
            await loadUsers();
            renderUsersTable();
        } else {
            showToast('Erreur de suppression', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// =====================
// CHAT
// =====================

async function loadChatUsers() {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/chat/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            chatUsers = await response.json();
        }
    } catch (error) {
        console.error('Error loading chat users:', error);
    }
}

function renderChatUsers() {
    const container = document.getElementById('chat-users-list');
    
    if (chatUsers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Aucun message</p>';
        return;
    }
    
    container.innerHTML = chatUsers.map(user => `
        <div class="chat-user-item ${currentChatUser && currentChatUser.id === user.id ? 'active' : ''}" data-id="${user.id}">
            <div class="chat-user-avatar">${getInitials(user.nom || user.telephone)}</div>
            <div class="chat-user-info">
                <div class="chat-user-name">${user.nom || ''} ${user.prenom || ''}</div>
                <div class="chat-user-last-message">${user.last_message || 'Aucun message'}</div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.chat-user-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = parseInt(item.dataset.id);
            const user = chatUsers.find(u => u.id === userId);
            if (user) openConversation(user);
        });
    });
}

async function openConversation(user) {
    currentChatUser = user;
    document.getElementById('chat-conversation-title').textContent = `${user.nom || ''} ${user.prenom || ''}`;
    
    // Update active state
    document.querySelectorAll('.chat-user-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.id) === user.id) {
            item.classList.add('active');
        }
    });
    
    await loadChatMessages(user.id);
}

async function loadChatMessages(userId) {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/chat/messages/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const messages = await response.json();
            renderChatMessages(messages);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById('admin-chat-messages');
    
    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Aucun message</p>';
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const isSent = msg.sender_type === 'admin';
        let content = msg.message;
        
        if (msg.audio_path) {
            content = `<audio controls src="${msg.audio_path}" style="max-width: 200px;"></audio>`;
        }
        
        return `
            <div class="message ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">
                <div class="message-content">
                    <p>${content}</p>
                    <span class="message-time">${formatTime(msg.created_at)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

document.getElementById('admin-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentChatUser) {
        showToast('Selectionnez un utilisateur', 'warning');
        return;
    }
    
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
                message
            })
        });
        
        if (response.ok) {
            input.value = '';
            await loadChatMessages(currentChatUser.id);
        } else {
            showToast('Erreur d\'envoi', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

// Voice recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

document.getElementById('btn-voice-admin').addEventListener('click', async () => {
    if (!currentChatUser) {
        showToast('Selectionnez un utilisateur', 'warning');
        return;
    }
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
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
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendVoiceMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start(1000);
            isRecording = true;
            document.getElementById('btn-voice-admin').classList.add('recording');
            showToast('Enregistrement en cours...', 'info');
        } catch (error) {
            showToast('Erreur d\'acces au microphone', 'error');
        }
    } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;
        document.getElementById('btn-voice-admin').classList.remove('recording');
    }
});

async function sendVoiceMessage(audioBlob) {
    try {
        const token = localStorage.getItem('admin_token');
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        formData.append('user_id', currentChatUser.id);
        
        const response = await fetch(`${API_URL}/api/chat/admin/voice`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        if (response.ok) {
            showToast('Message vocal envoye', 'success');
            await loadChatMessages(currentChatUser.id);
        } else {
            showToast('Erreur d\'envoi', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// =====================
// POSTS
// =====================

function renderPosts() {
    const posts = [
        { id: 'poste1', name: 'Police', icon: 'fa-user-police', color: '#3498db' },
        { id: 'poste2', name: 'Pompiers', icon: 'fa-fire-extinguisher', color: '#e74c3c' },
        { id: 'poste3', name: 'Ambulance', icon: 'fa-ambulance', color: '#27ae60' },
        { id: 'poste4', name: 'Protection civile', icon: 'fa-hard-hat', color: '#f39c12' },
        { id: 'poste5', name: 'Gendarmerie', icon: 'fa-shield-alt', color: '#9b59b6' },
        { id: 'poste6', name: 'Intelligence', icon: 'fa-user-secret', color: '#34495e' },
        { id: 'poste7', name: 'Administration', icon: 'fa-building', color: '#1abc9c' },
        { id: 'poste8', name: 'Urgence majeurs', icon: 'fa-exclamation-triangle', color: '#e67e22' }
    ];
    
    const container = document.getElementById('posts-grid');
    container.innerHTML = posts.map(post => {
        const postAlerts = alerts.filter(a => a.assigned_to === post.id);
        const active = postAlerts.filter(a => a.status === 'active').length;
        const inProgress = postAlerts.filter(a => a.status === 'en_cours').length;
        const resolved = postAlerts.filter(a => a.status === 'resolu').length;
        
        return `
            <div class="post-card">
                <div class="post-icon" style="background: ${post.color}">
                    <i class="fas ${post.icon}"></i>
                </div>
                <div class="post-name">${post.name}</div>
                <div class="post-stats">
                    <div class="post-stat">
                        <div class="post-stat-value">${active}</div>
                        <div class="post-stat-label">Actives</div>
                    </div>
                    <div class="post-stat">
                        <div class="post-stat-value">${inProgress}</div>
                        <div class="post-stat-label">En cours</div>
                    </div>
                    <div class="post-stat">
                        <div class="post-stat-value">${resolved}</div>
                        <div class="post-stat-label">Resolues</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// =====================
// EMERGENCY TYPES
// =====================

async function loadEmergencyTypes() {
    try {
        const response = await fetch(`${API_URL}/api/emergency-types`);
        if (response.ok) {
            window.emergencyTypes = await response.json();
        }
    } catch (error) {
        console.error('Error loading emergency types:', error);
    }
}

function renderEmergencyTypes() {
    const container = document.getElementById('emergency-types-grid');
    
    if (!window.emergencyTypes || window.emergencyTypes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Aucun type d\'urgence</p>';
        return;
    }
    
    container.innerHTML = window.emergencyTypes.map(type => `
        <div class="emergency-type-card">
            <div class="emergency-type-icon" style="background: ${type.couleur}">
                <i class="fas ${type.icone}"></i>
            </div>
            <div class="emergency-type-info">
                <div class="emergency-type-name">${type.nom}</div>
                <div class="emergency-type-priority">Priorite: ${type.priorite}</div>
            </div>
        </div>
    `).join('');
}

// =====================
// SYSTEM
// =====================

async function loadSystemInfo() {
    try {
        const token = localStorage.getItem('admin_token');
        
        // Load database info
        const dbResponse = await fetch(`${API_URL}/api/system/database`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (dbResponse.ok) {
            const dbInfo = await dbResponse.json();
            document.getElementById('db-path').textContent = dbInfo.path || './goma_security.db';
            document.getElementById('db-size').textContent = formatBytes(dbInfo.size || 0);
            document.getElementById('db-tables').textContent = dbInfo.tables || 0;
        }
        
        // Load server info
        const serverResponse = await fetch(`${API_URL}/api/system/server`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (serverResponse.ok) {
            const serverInfo = await serverResponse.json();
            document.getElementById('server-port').textContent = serverInfo.port || 3000;
            document.getElementById('server-env').textContent = serverInfo.environment || 'development';
            document.getElementById('server-uptime').textContent = formatUptime(serverInfo.uptime || 0);
            document.getElementById('server-memory').textContent = formatBytes(serverInfo.memory || 0);
        }
        
        // Load storage info
        const storageResponse = await fetch(`${API_URL}/api/system/storage`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (storageResponse.ok) {
            const storageInfo = await storageResponse.json();
            document.getElementById('storage-photos').textContent = `${storageInfo.photos || 0} fichiers`;
            document.getElementById('storage-voices').textContent = `${storageInfo.voices || 0} fichiers`;
            document.getElementById('storage-total').textContent = formatBytes(storageInfo.totalSize || 0);
        }
        
        // Load socket info
        const socketResponse = await fetch(`${API_URL}/api/system/socket`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (socketResponse.ok) {
            const socketInfo = await socketResponse.json();
            document.getElementById('socket-connections').textContent = socketInfo.connections || 0;
            document.getElementById('socket-messages').textContent = socketInfo.messages || 0;
        }
        
    } catch (error) {
        console.error('Error loading system info:', error);
    }
}

document.getElementById('btn-backup-db').addEventListener('click', async () => {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/system/backup`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `goma_security_backup_${new Date().toISOString().split('T')[0]}.db`;
            a.click();
            showToast('Sauvegarde effectuee', 'success');
        } else {
            showToast('Erreur de sauvegarde', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

document.getElementById('btn-cleanup-storage').addEventListener('click', async () => {
    if (!confirm('Voulez-vous nettoyer les fichiers inutilises?')) return;
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/system/cleanup`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(`${result.deleted || 0} fichiers supprimes`, 'success');
            loadSystemInfo();
        } else {
            showToast('Erreur de nettoyage', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

document.getElementById('btn-view-logs').addEventListener('click', async () => {
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/system/logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const logs = await response.text();
            const modalBody = document.getElementById('modal-body');
            modalBody.innerHTML = `<pre style="max-height: 400px; overflow: auto; background: #f5f5f5; padding: 15px; border-radius: 8px; font-size: 12px;">${logs}</pre>`;
            document.getElementById('modal-title').textContent = 'Logs du serveur';
            document.getElementById('modal').classList.remove('hidden');
        } else {
            showToast('Erreur de chargement des logs', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
});

// =====================
// SETTINGS
// =====================

document.getElementById('admin-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nom = document.getElementById('admin-nom').value;
    const prenom = document.getElementById('admin-prenom').value;
    const email = document.getElementById('admin-email').value;
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nom, prenom, email })
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

document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        if (response.ok) {
            showToast('Mot de passe change', 'success');
            document.getElementById('change-password-form').reset();
        } else {
            const data = await response.json();
            showToast(data.error || 'Erreur de changement', 'error');
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
        console.log('Admin connected');
    });
    
    socket.on('new-alert', (alert) => {
        showToast(`Nouvelle alerte: ${alert.type_nom}`, 'warning');
        loadAlerts();
        loadStats();
    });
    
    socket.on('alert-updated', (data) => {
        loadAlerts();
        loadStats();
    });
    
    socket.on('chat-message', (data) => {
        if (currentChatUser && currentChatUser.id === data.sender_id) {
            loadChatMessages(currentChatUser.id);
        }
        loadChatUsers();
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

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status) {
    const labels = {
        'active': 'Active',
        'en_cours': 'En cours',
        'resolu': 'Resolu'
    };
    return labels[status] || status;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}j ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Close modal
document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
});

// =====================
// DASHBOARD RENDERING
// =====================

function renderDashboard() {
    // Render recent alerts
    const recentAlertsContainer = document.getElementById('recent-alerts');
    const recentAlerts = alerts.slice(0, 5);
    
    if (recentAlerts.length === 0) {
        recentAlertsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Aucune alerte recente</p>';
    } else {
        recentAlertsContainer.innerHTML = recentAlerts.map(alert => `
            <div class="recent-item">
                <i class="fas ${alert.icone}" style="background: ${alert.couleur}"></i>
                <div class="recent-item-info">
                    <div class="recent-item-title">${alert.type_nom}</div>
                    <div class="recent-item-meta">${alert.nom} ${alert.prenom} - ${formatDate(alert.created_at)}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Render alerts by type chart
    const chartContainer = document.getElementById('alerts-by-type-chart');
    if (stats.by_type && stats.by_type.length > 0) {
        chartContainer.innerHTML = stats.by_type.map(type => `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1;">${type.nom}</div>
                <div style="width: 100px; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden;">
                    <div style="width: ${(type.count / stats.total) * 100}%; height: 100%; background: var(--primary-color);"></div>
                </div>
                <div style="width: 40px; text-align: right; font-weight: 600;">${type.count}</div>
            </div>
        `).join('');
    } else {
        chartContainer.innerHTML = '<p style="text-align: center; color: #999;">Aucune donnee</p>';
    }
}

// =====================
// INITIALIZE
// =====================

document.addEventListener('DOMContentLoaded', checkAuth);
