const themeSelect = document.getElementById('theme');
const cacheToggle = document.getElementById('cache');
const backButton = document.getElementById('back');

// Charger les paramètres actuels
document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const cacheEnabled = localStorage.getItem('cacheEnabled') === 'true';
    
    themeSelect.value = currentTheme;
    cacheToggle.checked = cacheEnabled;
});

// Gérer le changement de thème
themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
});

// Gérer le toggle du cache
cacheToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    localStorage.setItem('cacheEnabled', enabled);
});

// Retour à la page principale
backButton.addEventListener('click', () => {
    window.location.href = 'home.html';
});
