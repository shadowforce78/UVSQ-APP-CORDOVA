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
// --- Classe pour se connecter et récupérer les bulletins ---
class BulletinClient {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }

    async login() {
        try {
            // 1. Récupérer les cookies
            const cookieUrl = "https://bulletins.iut-velizy.uvsq.fr/services/data.php?q=dataPremi%C3%A8reConnexion";
            await fetch(cookieUrl, { method: 'POST' });

            // 2. Récupérer le token JWT
            const loginUrl = "https://cas2.uvsq.fr/cas/login?service=https%3A%2F%2Fbulletins.iut-velizy.uvsq.fr%2Fservices%2FdoAuth.php%3Fhref%3Dhttps%253A%252F%252Fbulletins.iut-velizy.uvsq.fr%252F";
            const loginPage = await fetch(loginUrl);
            const pageText = await loginPage.text();
            const tokenMatch = pageText.match(/name="execution" value="([^"]+)"/);
            const token = tokenMatch ? tokenMatch[1] : null;

            // 3. Effectuer la connexion
            const payload = {
                username: this.username,
                password: this.password,
                execution: token,
                _eventId: "submit",
                geolocation: "",
            };
            await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(payload).toString()
            });
        } catch (error) {
            console.error("Erreur lors de la connexion :", error.message);
        }
    }

    async fetchDatas() {
        const url = "https://bulletins.iut-velizy.uvsq.fr/services/data.php?q=dataPremi%C3%A8reConnexion";
        const headers = {
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers
            });
            const text = await response.text();
            return JSON.parse(text.replace(/\n/g, ""));
        } catch (error) {
            console.error("Erreur lors de la récupération des données :", error.message);
            return null;
        }
    }
}

export const connection = async (username, password) => {
    const client = new BulletinClient(username, password);
    await client.login();
    const data = await client.fetchDatas();
    if ("redirect" in data) {
        return { "error": "Identifiants invalides" };
    } else {
        return data;
    }
}