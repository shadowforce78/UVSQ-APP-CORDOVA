import { edt } from './API.js';

// Gestion du thème
function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialisation du thème
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme === 'dark');
document.getElementById('themeToggle').checked = savedTheme === 'dark';

// Event listener pour le toggle
document.getElementById('themeToggle').addEventListener('change', (e) => {
    setTheme(e.target.checked);
})

// Date handling
function adjustForWeekend(date) {
    const day = date.getDay();
    if (day === 0) { // Dimanche
        date.setDate(date.getDate() + 1); // Aller au lundi suivant
    } else if (day === 6) { // Samedi
        date.setDate(date.getDate() + 2); // Aller au lundi suivant
    }
    return date;
}

let currentDate = adjustForWeekend(new Date());

// Ajouter cette fonction utilitaire
function cloneDate(date) {
    return new Date(date.getTime());
}

function getWeekDates(date) {
    const currentDate = cloneDate(date);
    const first = currentDate.getDate() - currentDate.getDay() + 1;
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), first);
    const lastDay = new Date(firstDay.getTime());
    lastDay.setDate(firstDay.getDate() + 4);

    return {
        start: formatDate(firstDay),
        end: formatDate(lastDay)
    };
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Schedule display
async function displaySchedule() {
    const weekDates = getWeekDates(currentDate);
    const classe = document.querySelector('.dropbtn').textContent;
    const scheduleData = await edt(classe, weekDates.start, weekDates.end);

    // Mise à jour du label de la semaine
    const weekLabel = document.querySelector('.week-label');
    weekLabel.textContent = `Semaine du ${formatDateFr(weekDates.start)} au ${formatDateFr(weekDates.end)}`;

    const content = document.querySelector('.content');
    content.innerHTML = '';

    // Create weekly grid
    const grid = document.createElement('div');
    grid.className = 'schedule-grid';

    // Add time header (empty cell for the corner)
    const timeHeader = document.createElement('div');
    timeHeader.className = 'time-header';
    grid.appendChild(timeHeader);

    // Add headers for days
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        grid.appendChild(dayHeader);
    });

    // Add time slots - only full hours
    for (let hour = 8; hour <= 18; hour++) {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.textContent = `${String(hour).padStart(2, '0')}:00`;
        grid.appendChild(timeSlot);

        // Add empty cells for each day
        for (let i = 0; i < 5; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'time-cell';
            grid.appendChild(dayCell);
        }
    }

    // Process and display events in a container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'events-container';
    
    const eventGroups = findOverlappingEvents(scheduleData);
    
    Object.values(eventGroups).forEach(dayEvents => {
        dayEvents.forEach((eventData, index) => {
            const position = calculateEventPosition(
                eventData.timeInfo,
                eventData,
                eventData.exactOverlap,
                index
            );
            const eventDiv = createEventElement(eventData.event, position);
            eventsContainer.appendChild(eventDiv);
        });
    });

    grid.appendChild(eventsContainer);
    content.appendChild(grid);
}

// Ajouter cette nouvelle fonction pour formater la date en français
function formatDateFr(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function parseEventTime(timeString) {
    // Format: "16/12/2024 13:00-17:00"
    const [date, time] = timeString.split(' ');
    const [start, end] = time.split('-');
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const day = new Date(date.split('/').reverse().join('-')).getDay();

    return {
        day: day === 0 ? 6 : day - 1, // Convertir dimanche(0) en 6 et décaler les autres jours
        startTime: startHour + startMinute / 60,
        endTime: endHour + endMinute / 60
    };
}

function calculateEventPosition(timeInfo, event, overlappingGroup = [], eventIndex = 0) {
    const hourHeight = 60;
    const startHour = timeInfo.startTime - 8;
    const duration = timeInfo.endTime - timeInfo.startTime;
    
    const top = startHour * hourHeight;
    const height = duration * hourHeight - 2;
    
    const cellWidth = 100 / 5; // Largeur d'une cellule journalière
    const dayOffset = timeInfo.day * cellWidth;

    // Si l'événement a des chevauchements exacts
    if (event.exactOverlap && event.exactOverlap.length > 0) {
        const width = cellWidth / (event.exactOverlap.length + 1);
        const isEven = eventIndex % 2 === 0;
        const left = dayOffset + (width * eventIndex);
        return { top, height, left, width };
    } else {
        // Pas de chevauchement exact, prendre toute la largeur
        return {
            top,
            height,
            left: dayOffset,
            width: cellWidth
        };
    }
}

// Déplacer getElementContent en tant que fonction globale
function getElementContent(event, label) {
    if (!event || !event.elements) {
        console.warn('Event or elements is undefined');
        return 'Non spécifié';
    }

    // Normalisation pour la recherche insensible aux accents
    const normalizedLabel = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const element = event.elements.find(e => {
        if (!e || !e.label) return false;
        return e.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedLabel;
    });

    return element ? element.content : 'Non spécifié';
}

// Modifier createEventElement pour utiliser la nouvelle fonction globale
function createEventElement(event, position) {
    const div = document.createElement('div');
    div.className = 'event';

    const timeData = getElementContent(event, "Heure");
    const subject = getElementContent(event, "Matiere");
    const group = getElementContent(event, "Groupe");
    let category = getElementContent(event, 'Catégorie d’événement')


    category = category.trim();
    const categoryLower = category.toLowerCase();


    // Ajouter la classe CSS selon le type de cours
    let appliedClass = 'other';
    if (categoryLower.includes('td')) {
        div.classList.add('td');
        appliedClass = 'td';
    } else if (categoryLower.includes('cm')) {
        div.classList.add('cm');
        appliedClass = 'cm';
    } else if (categoryLower.includes('tp')) {
        div.classList.add('tp');
        appliedClass = 'tp';
    } else {
        div.classList.add('other');
    }


    div.style.top = `${position.top}px`;
    div.style.height = `${position.height}px`;
    div.style.left = `${position.left}%`;
    div.style.width = `${position.width}%`;

    div.innerHTML = `
        <div class="event-time">${timeData}</div>
        <div class="event-subject">${subject}</div>
        <div class="event-details">${group} - ${category}</div>
    `;

    return div;
}

function findOverlappingEvents(events) {
    const eventGroups = {};
    
    events.forEach(event => {
        const timeData = parseEventTime(getElementContent(event, "Heure"));
        const dayKey = timeData.day;
        if (!eventGroups[dayKey]) {
            eventGroups[dayKey] = [];
        }
        eventGroups[dayKey].push({
            event,
            timeInfo: timeData
        });
    });

    // Pour chaque jour, trouver les événements qui se chevauchent exactement
    Object.values(eventGroups).forEach(dayEvents => {
        dayEvents.forEach(current => {
            current.exactOverlap = dayEvents.filter(other => 
                current !== other && 
                current.timeInfo.startTime === other.timeInfo.startTime &&
                current.timeInfo.endTime === other.timeInfo.endTime
            );
        });
    });

    return eventGroups;
}

// Event listeners
document.getElementById('prev').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 7);
    displaySchedule();
});

document.getElementById('next').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 7);
    displaySchedule();
});

document.getElementById('today').addEventListener('click', () => {
    currentDate = adjustForWeekend(new Date());
    displaySchedule();
});

document.getElementById('back').addEventListener('click', () => {
    window.location.href = 'home.html';
});

// Initialize
const classes = ['inf1-b', 'mmi1-a2'];
const dropdownContent = document.querySelector('.dropdown-content');
const dropdownButton = document.querySelector('.dropbtn');
const dropdown = document.querySelector('.dropdown');

// Gestion du clic sur le bouton dropdown
dropdownButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
});

// Fermer le dropdown si on clique ailleurs
document.addEventListener('click', () => {
    dropdown.classList.remove('open');
});

classes.forEach(classe => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = classe;
    a.onclick = (e) => {
        e.preventDefault();
        dropdownButton.textContent = classe;
        dropdown.classList.remove('open');
        displaySchedule();
    };
    dropdownContent.appendChild(a);
});

// Set default class and display schedule
document.querySelector('.dropbtn').textContent = classes[0];
displaySchedule();
