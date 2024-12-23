(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Supprimez la ligne d'import d'axios puisqu'il sera disponible globalement via CDN
// const axios = window.axios;  // Optionnel: vous pouvez utiliser cette ligne si vous voulez être explicite

// Fonction de debug
const debug = (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
};

// Configuration de base d'Axios
const axiosInstance = axios.create({
    withCredentials: true,
    headers: {
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
});

// Intercepteur pour le debug
axiosInstance.interceptors.request.use(
    config => {
        debug(`Requête ${config.method.toUpperCase()} vers: ${config.url}`, config);
        return config;
    },
    error => {
        debug('Erreur de requête', error);
        return Promise.reject(error);
    }
);

axiosInstance.interceptors.response.use(
    response => {
        debug(`Réponse reçue: ${response.status}`, response.data);
        return response;
    },
    error => {
        debug('Erreur de réponse', error);
        return Promise.reject(error);
    }
);

// --- Fonction pour lire les données de l'emploi du temps ---
const edt = async (classe, startDate, endDate) => {
    const endPointUrl = "https://edt.iut-velizy.uvsq.fr/Home/GetCalendarData";
    
    function makeBody(startDate, endDate, federationIds) {
        return {
            start: startDate,
            end: endDate,
            resType: "103",
            calView: "agendaWeek",
            federationIds: [federationIds],
            colourScheme: "3",
        };
    }

    function formatEvents(events) {
        const formattedData = {};

        events.forEach((event) => {
            const startTime = new Date(event.start);
            const endTime = new Date(event.end);

            const eventInfo = {
                ID: event.id,
                Début: startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                Fin: endTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                Description: event.description
                    .replace(/<br \/>/g, "\n")
                    .replace(/&39;/g, "'")
                    .trim(),
                "Professeur(s)": event.description.split("<br />")[0],
                "Module(s)": event.modules ? event.modules.join(", ") : "Non spécifié",
                Type: event.eventCategory,
                Site: event.sites ? event.sites.join(", ") : "Non spécifié",
                Couleur: event.backgroundColor,
            };

            const dateStr = startTime.toISOString().split("T")[0];
            if (!formattedData[dateStr]) {
                formattedData[dateStr] = [];
            }

            formattedData[dateStr].push(eventInfo);
        });

        return formattedData;
    }

    async function fetchEventDetails(eventId) {
        try {
            const response = await axiosInstance.post(
                "https://edt.iut-velizy.uvsq.fr/Home/GetSideBarEvent",
                { eventId },
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            return response.data;
        } catch (error) {
            console.error(`Erreur lors de la récupération des détails de l'événement ${eventId}:`, error.message);
            return null;
        }
    }

    try {
        const response = await axiosInstance.post(
            endPointUrl,
            makeBody(startDate, endDate, classe),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        const data = formatEvents(response.data);
        const cours = [];

        for (const date in data) {
            for (const event of data[date]) {
                const details = await fetchEventDetails(event.ID);
                if (details) cours.push(details);
            }
        }

        return cours;
    } catch (error) {
        debug('Erreur EDT', error);
        throw error;
    }
};

const connection = async (username, password) => {
    debug('Tentative de connexion', { username });

    try {
        const baseUrl = "https://bulletins.iut-velizy.uvsq.fr";
        const casUrl = "https://cas2.uvsq.fr/cas/login";
        const serviceUrl = encodeURIComponent(`${baseUrl}/services/doAuth.php`);

        // 1. Obtenir le formulaire de login et le token
        const loginPageResponse = await axiosInstance.get(`${casUrl}?service=${serviceUrl}`);
        const pageText = loginPageResponse.data;
        const tokenMatch = pageText.match(/name="execution" value="([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : null;

        if (!token) {
            debug('Token non trouvé');
            return { error: "Impossible de récupérer le token" };
        }

        // 2. Soumission des identifiants
        const formData = new URLSearchParams({
            username,
            password,
            execution: token,
            _eventId: "submit",
            geolocation: "",
        });

        await axiosInstance.post(`${casUrl}?service=${serviceUrl}`, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://cas2.uvsq.fr',
                'Referer': `${casUrl}?service=${serviceUrl}`,
            },
            maxRedirects: 5
        });

        // 3. Vérification finale
        const verifyResponse = await axiosInstance.get(`${baseUrl}/services/data.php?q=dataPremi%C3%A8reConnexion`);
        return verifyResponse.data;

    } catch (error) {
        debug('Erreur de connexion', { error });
        return { error: "Erreur de connexion" };
    }
};

// Export de l'instance axios configurée
const getAxiosInstance = () => axiosInstance;

module.exports = {
    edt,
    connection,
    getAxiosInstance
};
},{}],2:[function(require,module,exports){
const API = require('./API');

// Expose les fonctions globalement
window.edt = API.edt;
window.connection = API.connection;
window.getAxiosInstance = API.getAxiosInstance;

},{"./API":1}]},{},[2]);
