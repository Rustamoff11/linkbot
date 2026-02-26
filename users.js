let users = {};
let blockedUsers = [];

function logAction(userId, action) {
    if(!users[userId]) users[userId] = [];
    users[userId].push({ action, date: new Date().toLocaleString() });
}

function getUserActions(userId) {
    return users[userId] || [];
}

function blockUser(userId) {
    if(!blockedUsers.includes(userId)) blockedUsers.push(userId);
}

function unblockUser(userId) {
    blockedUsers = blockedUsers.filter(id => id !== userId);
}

function isBlocked(userId) {
    return blockedUsers.includes(userId);
}

function getAllUsers() {
    return users;
}

export { logAction, getUserActions, blockUser, unblockUser, isBlocked, getAllUsers };