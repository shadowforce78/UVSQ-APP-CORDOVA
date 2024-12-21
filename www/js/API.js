const corsProxy = 'http://saumondeluxe.ddns.net:63244';
const apiURL = 'http://saumondeluxe.ddns.net:63246';

const connectionENDPOINT = (id, password) => {
    const encodedPassword = encodeURIComponent(password);
    return `/uvsq/bulletin/${encodeURIComponent(id)}+${encodedPassword}`;
};

const edtENDPOINT = (classe, startdate, endate) => 
    `/uvsq/edt/${encodeURIComponent(classe)}+${startdate}+${endate}`;

// Partie connection
export const connection = async (id, password) => {
    try {
        const url = `${corsProxy}/${apiURL.replace('https://', '')}${connectionENDPOINT(id, password)}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': window.location.origin,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (response.status === 400) {
            return { error: 'Erreur d\'authentification - Vérifiez vos identifiants' };
        }
        
        if (!response.ok) {
            return { error: `Erreur de connexion (${response.status})` };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Connection error:', error);
        return { error: 'Impossible de se connecter au serveur' };
    }
}

// Partie emploi du temps
export const edt = async (classe, startdate, endate) => {
    try {
        const url = `${corsProxy}/${apiURL.replace('https://', '')}${edtENDPOINT(classe, startdate, endate)}`;
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': window.location.origin,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            return { error: `Erreur de récupération (${response.status})` };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('EDT error:', error);
        return { error: 'Impossible de récupérer l\'emploi du temps' };
    }
}