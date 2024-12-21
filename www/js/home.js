window.addEventListener('DOMContentLoaded', () => {
    // Gestion du thème
    function setTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Initialisation du thème
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme === 'dark');

    const replaceText = (selector, text) => {
        const elements = document.getElementsByClassName(selector)
        if (elements.length > 0) elements[0].innerText = text
    }

    const storedData = localStorage.getItem('userData');

    function getName(data) {
        data = JSON.parse(data);
        let prenom = data['auth'].name;
        return prenom || 'Nom Introuvable';
    }

    function getEdt() {
        window.location.href = 'edt.html';
    }
    document.getElementById('edt').addEventListener('click', getEdt);

    function getNotes(){
        window.location.href = 'notes.html';
    }
    document.getElementById('notes').addEventListener('click', getNotes);

    replaceText('prenom', getName(storedData));

    function getAbscences(){
        window.location.href = 'abscence.html';
    }
    document.getElementById('absences').addEventListener('click', getAbscences);


    function getSettings(){
        window.location.href = 'settings.html';
    }
    document.getElementById('settings').addEventListener('click', getSettings);

    // Gestionnaire de déconnexion
    document.getElementById('logout').addEventListener('click', () => {
        localStorage.removeItem('userData');
        localStorage.removeItem('userId');
        localStorage.removeItem('userPassword');
        window.location.href = 'login.html';
    });
})