// Fonction de debug
const debug = (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
};

// Création d'une classe pour gérer la session
class Session {
    constructor() {
        this.cookieJar = new Map();
        debug('Session initialisée');
    }

    parseCookies(cookieHeader) {
        if (!cookieHeader) return;
        cookieHeader.split(',').forEach(cookie => {
            const parts = cookie.split(';')[0].trim().split('=');
            if (parts.length === 2) {
                this.cookieJar.set(parts[0], parts[1]);
            }
        });
    }

    getCookieString() {
        return Array.from(this.cookieJar.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    async fetch(url, options = {}) {
        debug(`Requête vers: ${url}`, { 
            method: options.method || 'GET',
            headers: options.headers,
            cookiesExist: this.cookieJar.size > 0
        });

        // Ajouter les cookies à la requête
        if (this.cookieJar.size > 0) {
            options.headers = {
                ...options.headers,
                'Cookie': this.getCookieString()
            };
        }

        // Configurer la gestion des redirections
        options.redirect = 'manual';
        options.credentials = 'include';
        
        try {
            const response = await fetch(url, options);
            debug(`Réponse reçue: ${response.status} ${response.statusText}`, {
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // Gérer les cookies de la réponse
            const cookies = response.headers.get('set-cookie');
            if (cookies) {
                this.parseCookies(cookies);
                debug('Cookies mis à jour', { 
                    cookieCount: this.cookieJar.size
                });
            }

            // Gérer les redirections manuellement
            if (response.status === 302 || response.status === 301) {
                const location = response.headers.get('location');
                if (location) {
                    debug('Redirection vers', { location });
                    return this.fetch(location, {
                        ...options,
                        method: 'GET'
                    });
                }
            }

            return response;
        } catch (error) {
            debug('Erreur fetch', { error: error.message });
            throw error;
        }
    }

    clearCookies() {
        this.cookieJar.clear();
        debug('Cookies effacés');
    }
}

// Instance globale de session
const session = new Session();

// --- Fonction pour lire les données de l'emploi du temps ---
export const edt = async (classe, startDate, endDate) => {
    const endPointUrl = "https://edt.iut-velizy.uvsq.fr/Home/GetCalendarData";

    const headers = {
        'Accept': "application/json, text/javascript, */*; q=0.01",
        'Accept-Language': "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8",
    };

    function makeBody(startDate, endDate, federationIds) {
        return new URLSearchParams({
            start: startDate,
            end: endDate,
            resType: "103",
            calView: "agendaWeek",
            federationIds: JSON.stringify([federationIds]),
            colourScheme: "3",
        }).toString();
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
        const endpoint = "https://edt.iut-velizy.uvsq.fr/Home/GetSideBarEvent";
        const body = new URLSearchParams({ eventId });

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body
            });
            return await response.json();
        } catch (error) {
            console.error(`Erreur lors de la récupération des détails de l'événement ${eventId}:`, error.message);
            return null;
        }
    }

    async function fetchAndFormatData(startDate, endDate, className) {
        const body = makeBody(startDate, endDate, className);
        const response = await fetch(endPointUrl, {
            method: 'POST',
            headers: headers,
            body: body
        });
        const events = await response.json();
        return formatEvents(events);
    }

    const data = await fetchAndFormatData(startDate, endDate, classe);
    const cours = [];

    for (const date in data) {
        for (const event of data[date]) {
            const details = await fetchEventDetails(event.ID);
            if (details) cours.push(details);
        }
    }

    return cours;
}

export const connection = async (username, password) => {
    debug('Tentative de connexion', { username });
    session.clearCookies(); // Reset cookies before new connection attempt

    try {
        const loginUrl = "https://cas2.uvsq.fr/cas/login?service=https%3A%2F%2Fbulletins.iut-velizy.uvsq.fr%2Fservices%2FdoAuth.php%3Fhref%3Dhttps%253A%252F%252Fbulletins.iut-velizy.uvsq.fr%252F";
        
        // 1. Récupération du token
        debug('Récupération de la page de login');
        const loginPage = await session.fetch(loginUrl);
        const pageText = await loginPage.text();
        const tokenMatch = pageText.match(/name="execution" value="([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : null;

        if (!token) {
            debug('Token non trouvé dans la page');
            return { error: "Impossible de récupérer le token" };
        }
        debug('Token récupéré', { token });

        // 2. Connexion
        debug('Envoi des identifiants');
        const loginResponse = await session.fetch(loginUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                username,
                password,
                execution: token,
                _eventId: "submit",
                geolocation: ""
            }).toString()
        });
        debug('Réponse login reçue', { 
            status: loginResponse.status,
            url: loginResponse.url
        });

        // Suivre explicitement la redirection après le POST
        const finalResponse = await session.fetch(loginResponse.headers.get('location') || loginUrl);
        if (!finalResponse.ok) {
            return { error: "Erreur lors de la redirection" };
        }

        // 3. Récupération des données
        debug('Récupération des données utilisateur');
        const dataUrl = "https://bulletins.iut-velizy.uvsq.fr/services/data.php?q=dataPremi%C3%A8reConnexion";
        const response = await session.fetch(dataUrl, {
            method: 'POST',
            headers: {
                "Accept-Language": "fr-FR,fr;q=0.9",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            }
        });

        const text = await response.text();
        const data = JSON.parse(text.replace(/\n/g, ""));
        
        debug('Données reçues', { 
            hasRedirect: "redirect" in data,
            dataKeys: Object.keys(data)
        });

        return "redirect" in data 
            ? { error: "Identifiants invalides" }
            : data;

    } catch (error) {
        debug('Erreur de connexion', { 
            error: error.message,
            stack: error.stack
        });
        return { error: "Erreur de connexion" };
    }
};

// Export de la session pour une utilisation dans d'autres fichiers
export const getSession = () => session;