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
        this.csrfToken = null;
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

        // Configuration de base pour toutes les requêtes
        const baseOptions = {
            mode: options.method === 'POST' ? 'no-cors' : 'cors', // Désactiver CORS pour POST
            credentials: 'include',
            redirect: 'manual',
            ...options,
            headers: {
                'Accept': 'application/json, text/html, */*',
                'Accept-Language': 'fr-FR,fr;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...options.headers
            }
        };

        // Ajouter les cookies à la requête
        if (this.cookieJar.size > 0) {
            baseOptions.headers['Cookie'] = this.getCookieString();
        }

        try {
            const response = await fetch(url, baseOptions);
            debug(`Réponse reçue: ${response.status} ${response.statusText}`, {
                headers: Object.fromEntries(response.headers.entries()),
                url: response.url
            });

            // Gérer les cookies de la réponse
            const cookies = response.headers.get('set-cookie');
            if (cookies) {
                this.parseCookies(cookies);
                debug('Cookies mis à jour', { 
                    cookieCount: this.cookieJar.size,
                    cookies: this.getCookieString()
                });
            }

            // Gérer les redirections manuellement
            if (response.status === 302 || response.status === 301) {
                const location = response.headers.get('location');
                if (location) {
                    debug('Redirection vers', { location });
                    // Attendre un peu avant de suivre la redirection
                    await new Promise(resolve => setTimeout(resolve, 100));
                    return this.fetch(location, {
                        ...options,
                        method: 'GET',
                        body: undefined
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
    session.clearCookies();

    try {
        const baseUrl = "https://bulletins.iut-velizy.uvsq.fr";
        const casUrl = "https://cas2.uvsq.fr/cas/login";
        const serviceUrl = encodeURIComponent(`${baseUrl}/services/doAuth.php`);
        
        // 1. Initialiser la session avec le service cible
        await session.fetch(`${baseUrl}/services/doAuth.php`);
        
        // 2. Obtenir le formulaire de login et le token
        const loginPageResponse = await session.fetch(`${casUrl}?service=${serviceUrl}`);
        const pageText = await loginPageResponse.text();
        const tokenMatch = pageText.match(/name="execution" value="([^"]+)"/);
        const token = tokenMatch ? tokenMatch[1] : null;

        if (!token) {
            debug('Token non trouvé');
            return { error: "Impossible de récupérer le token" };
        }

        // 3. Soumission des identifiants avec tous les champs nécessaires
        const formData = new URLSearchParams({
            username,
            password,
            execution: token,
            _eventId: "submit",
            geolocation: "",
            submit: "SE CONNECTER"
        });

        const loginResponse = await session.fetch(`${casUrl}?service=${serviceUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'text/html',
                'Origin': 'https://cas2.uvsq.fr',
                'Referer': `${casUrl}?service=${serviceUrl}`,
                'Upgrade-Insecure-Requests': '1'
            },
            body: formData.toString()
        });

        // 4. Vérification finale
        const verifyResponse = await session.fetch(`${baseUrl}/services/data.php?q=dataPremi%C3%A8reConnexion`);
        const data = await verifyResponse.json();

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