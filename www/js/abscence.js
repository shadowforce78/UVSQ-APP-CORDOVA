window.addEventListener('DOMContentLoaded', () => {
    // Ajout de la gestion du bouton retour
    document.getElementById('backButton').addEventListener('click', () => {
        window.location.href = 'home.html';
    });

    // Gestion du thème
    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    function setTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // Initialiser le thème
    const savedTheme = localStorage.getItem('theme');
    const initialTheme = savedTheme 
        ? savedTheme === 'dark'
        : prefersDark.matches;
    setTheme(initialTheme);

    // Écouteur d'événement pour le bouton
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(!isDark);
    });

    const userData = localStorage.getItem('userData');
    const data = JSON.parse(userData);
    const absences = data['absences'];
    const mainDiv = document.querySelector('.main');

    // Ensure absences is not null/undefined
    if (!absences) {
        const noData = document.createElement('p');
        noData.textContent = 'Aucune absence trouvée';
        mainDiv.appendChild(noData);
        return;
    }

    // Convert object entries to array and sort by date
    const sortedDates = Object.entries(absences).sort(([dateA], [dateB]) => {
        return new Date(dateB) - new Date(dateA);
    });

    sortedDates.forEach(([date, absencesList], index) => {
        // Filtrer les absences avec statut asbent ou retard
        const nonPresentAbsences = Array.isArray(absencesList)
            ? absencesList.filter(absence => {
                const statut = absence.statut.toLowerCase();
                return statut.includes('retard') || statut.includes('absent');
            })
            : [];

        // N'afficher la date que s'il y a des absences non présent
        if (nonPresentAbsences.length > 0) {
            const dateHeader = document.createElement('h2');
            dateHeader.textContent = `${new Date(date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
            mainDiv.appendChild(dateHeader);

            nonPresentAbsences.forEach((absence) => {
                const absenceDiv = document.createElement('div');
                absenceDiv.classList.add('absence');

                // Ajouter la classe appropriée selon le statut
                const statut = absence.statut.toLowerCase();
                if (statut.includes('retard')) {
                    absenceDiv.classList.add('retard');
                } else if (statut.includes('absent')) {
                    absenceDiv.classList.add('absent');
                }

                absenceDiv.style.animationDelay = `${index * 0.1}s`;

                const time = document.createElement('p');
                time.textContent = `Heure: ${absence.debut} - ${absence.fin}`;
                absenceDiv.appendChild(time);

                const statutElement = document.createElement('p');
                statutElement.textContent = `Statut: ${absence.statut}`;
                absenceDiv.appendChild(statutElement);

                mainDiv.appendChild(absenceDiv);
            });
        }
    });
});