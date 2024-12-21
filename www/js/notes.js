window.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('userData');
    const releve = JSON.parse(userData);
    const ues = releve["relevé"]["ues"]
    const ressources = releve["relevé"]["ressources"]
    const saes = releve["relevé"]["saes"]

    // Gestion du thème depuis le localStorage
    function setTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }

    // Initialisation du thème depuis le cache
    const cachedTheme = localStorage.getItem('theme');
    setTheme(cachedTheme === 'dark');

    const modal = document.getElementById('detailModal');
    const modalContent = document.getElementById('modalContent');
    const closeBtn = document.getElementsByClassName('close')[0];

    const evaluationModal = document.getElementById('evaluationModal');
    const evaluationModalContent = document.getElementById('evaluationModalContent');
    const evaluationCloseBtn = document.getElementsByClassName('evaluation-close')[0];

    function showEvaluationDetails(evaluation) {
        const noteStats = evaluation.note || { value: 'Non notée', min: 'N/A', max: 'N/A', moy: 'N/A' };
        
        evaluationModalContent.innerHTML = `
            <div class="evaluation-details">
                <dl>
                    <dt>ID</dt>
                    <dd>${evaluation.id}</dd>
                    <dt>Coefficient</dt>
                    <dd>${evaluation.coef}</dd>
                    <dt>Date</dt>
                    <dd>${new Date(evaluation.date_debut).toLocaleDateString()}</dd>
                </dl>
                <div class="note-stats" role="region" aria-label="Statistiques de notes">
                    <dl>
                        <dt>Note</dt>
                        <dd>${noteStats.value}</dd>
                        <dt>Minimum</dt>
                        <dd>${noteStats.min}</dd>
                        <dt>Maximum</dt>
                        <dd>${noteStats.max}</dd>
                        <dt>Moyenne</dt>
                        <dd>${noteStats.moy}</dd>
                    </dl>
                </div>
                ${evaluation.remarque ? `<p aria-label="Remarque">${evaluation.remarque}</p>` : ''}
                ${evaluation.description ? `<p aria-label="Description">${evaluation.description}</p>` : ''}
            </div>
        `;
        evaluationModal.style.display = 'block';
        
        // Focus management
        const closeButton = evaluationModal.querySelector('.evaluation-close');
        closeButton.focus();
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (evaluationModal.style.display === 'block') {
                evaluationModal.style.display = 'none';
            }
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        }
    });

    function showDetails(type, code) {
        const details = type === 'ressource' ? ressources[code] : saes[code];
        if (!details) return;

        let evaluationsHTML = '';
        
        if (details.evaluations && details.evaluations.length > 0) {
            evaluationsHTML = details.evaluations.map((evaluation, index) => `
                <div class="detail-item evaluation-clickable" data-evaluation-index="${index}">
                    <h3>Évaluation ${index + 1}</h3>
                    <p><strong>ID:</strong> ${evaluation.id}</p>
                    <p><strong>Note:</strong> ${evaluation.note?.value || 'Non notée'}</p>
                    ${evaluation.description ? `<p><strong>Description:</strong> ${evaluation.description}</p>` : ''}
                </div>
            `).join('');
        } else {
            evaluationsHTML = '<div class="detail-item">Aucune évaluation disponible</div>';
        }
        
        modalContent.innerHTML = `
            <h2>${code} - ${details.titre || 'Sans titre'}</h2>
            <p><strong>Code Apogée:</strong> ${details.code_apogee || 'Non spécifié'}</p>
            <div class="detail-grid">
                ${evaluationsHTML}
            </div>
        `;
        modal.style.display = 'block';

        // Ajouter les écouteurs d'événements pour les évaluations
        document.querySelectorAll('.evaluation-clickable').forEach(item => {
            item.addEventListener('click', () => {
                const index = item.dataset.evaluationIndex;
                showEvaluationDetails(details.evaluations[index]);
            });
        });
    }

    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === evaluationModal) evaluationModal.style.display = 'none';
    }

    evaluationCloseBtn.onclick = () => evaluationModal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === evaluationModal) evaluationModal.style.display = 'none';
    };

    // Gestion du responsive pour les modales
    let touchStartY = 0;
    let touchEndY = 0;

    function handleSwipeGesture(modal) {
        const minSwipeDistance = 50;
        const swipeDistance = touchEndY - touchStartY;

        if (swipeDistance > minSwipeDistance) {
            modal.style.display = 'none';
        }
    }

    [modal, evaluationModal].forEach(modal => {
        modal.addEventListener('touchstart', e => {
            touchStartY = e.touches[0].clientY;
        }, false);

        modal.addEventListener('touchend', e => {
            touchEndY = e.changedTouches[0].clientY;
            handleSwipeGesture(modal);
        }, false);
    });

    function displayGrades() {
        const container = document.getElementById('grades-container');
        
        Object.entries(ues).forEach(([ueKey, ueData]) => {
            const ueElement = document.createElement('div');
            ueElement.className = 'ue-card';
            ueElement.setAttribute('role', 'region');
            ueElement.setAttribute('aria-label', `UE ${ueData.titre}`);
            
            ueElement.innerHTML = `
                <div class="ue-header">
                    <span class="ue-title">${ueData.titre}</span>
                    <span class="ue-average">Moyenne: ${ueData.moyenne.value}</span>
                </div>
                <div class="resources-container">
                    <h3>Ressources</h3>
                    ${Object.entries(ueData.ressources).map(([key, resource]) => `
                        <div class="grade-item" data-type="ressource" data-code="${key}">
                            <span>${key}</span>
                            <span>${resource.moyenne !== '~' ? resource.moyenne : 'Non notée'}</span>
                        </div>
                    `).join('')}
                </div>
                ${ueData.saes ? `
                    <div class="saes-container">
                        <h3>SAÉs</h3>
                        ${Object.entries(ueData.saes).map(([key, sae]) => `
                            <div class="grade-item" data-type="sae" data-code="${key}">
                                <span>${key}</span>
                                <span>${sae.moyenne !== '~' ? sae.moyenne : 'Non notée'}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
            container.appendChild(ueElement);
        });

        // Ajouter les écouteurs d'événements après avoir créé les éléments
        document.querySelectorAll('.grade-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const code = item.dataset.code;
                showDetails(type, code);
            });
        });

        // Ajout de la gestion des événements tactiles
        document.querySelectorAll('.grade-item').forEach(item => {
            item.addEventListener('touchend', e => {
                if (Math.abs(touchEndY - touchStartY) < 10) {
                    const type = item.dataset.type;
                    const code = item.dataset.code;
                    showDetails(type, code);
                }
            });
        });
    }

    displayGrades();

    // Ajout de la navigation
    document.getElementById('backButton').addEventListener('click', () => {
        window.location.href = 'home.html';
    });
});