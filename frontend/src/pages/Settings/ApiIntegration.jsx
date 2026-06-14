import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Copy, CheckCircle, Code, Terminal, Server, Globe, Download, Briefcase } from 'lucide-react';

const htmlTemplate = `<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anfrageformular | API Integration</title>
    <!-- FontAwesome for Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #3b82f6;
            --primary-dark: #2563eb;
            --bg: #030712;
            --card: #0f172a;
            --card-border: rgba(255, 255, 255, 0.1);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --input-bg: rgba(255, 255, 255, 0.03);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            line-height: 1.6;
            overflow-x: hidden;
            gap: 40px;
        }

        /* Hero Background / Glow */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 50% -20%, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
            z-index: -1;
        }

        .container {
            width: 100%;
            max-width: 800px;
            background: var(--card);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(10px);
        }

        .close-btn {
            position: absolute;
            top: 25px;
            right: 25px;
            color: var(--text-muted);
            font-size: 1.2rem;
            cursor: pointer;
            transition: color 0.2s;
        }

        .close-btn:hover {
            color: white;
        }

        /* Documentation Styles */
        .doc-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
        }

        .doc-card h2 {
            font-size: 1.2rem;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
        }

        .doc-card p {
            font-size: 0.95rem;
            color: var(--text-muted);
            margin-bottom: 10px;
        }

        .code-block {
            background: #0d1117;
            padding: 15px;
            border-radius: 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            margin: 15px 0;
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: #d1d5db;
            overflow-x: auto;
            white-space: pre;
        }

        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 0.75rem;
            margin-right: 8px;
            text-transform: uppercase;
        }

        .badge-post {
            background: rgba(34, 197, 94, 0.1);
            color: #4ade80;
        }

        .badge-get {
            background: rgba(59, 130, 246, 0.1);
            color: #60a5fa;
        }

        /* Header / Progress */
        .header {
            text-align: center;
            margin-bottom: 40px;
        }

        .progress-container {
            width: 100%;
            max-width: 300px;
            height: 4px;
            background: rgba(255, 255, 255, 0.05);
            margin: 0 auto 30px;
            border-radius: 2px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: var(--primary);
            width: 20%;
            transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }

        .step-label {
            color: var(--primary);
            text-transform: uppercase;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            margin-bottom: 8px;
            display: block;
        }

        h1 {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 10px;
        }

        /* Wizard Steps */
        .step {
            display: none;
            animation: slideUp 0.5s ease-out;
        }

        .step.active {
            display: block;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Grid Options */
        .grid-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }

        .card-option {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 30px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
        }

        .card-option i {
            font-size: 2rem;
            color: var(--primary);
            opacity: 0.8;
            transition: transform 0.3s;
        }

        .card-option:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(59, 130, 246, 0.4);
            transform: translateY(-5px);
        }

        .card-option:hover i {
            transform: scale(1.1);
        }

        .card-option.selected {
            background: rgba(59, 130, 246, 0.1);
            border-color: var(--primary);
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
        }

        .card-option h3 {
            font-size: 1rem;
            font-weight: 500;
        }

        /* Form Controls */
        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-size: 0.9rem;
            color: var(--text-muted);
        }

        input,
        select,
        textarea {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--card-border);
            border-radius: 12px;
            padding: 14px 18px;
            color: white;
            font-size: 1rem;
            transition: all 0.2s;
        }

        input:focus,
        textarea:focus {
            outline: none;
            border-color: var(--primary);
            background: rgba(255, 255, 255, 0.05);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }

        /* Buttons */
        .actions {
            margin-top: 40px;
            display: flex;
            gap: 15px;
        }

        button {
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            flex: 1;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
            border: none;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: scale(1.02);
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: transparent;
            color: var(--text-muted);
            border: 1px solid var(--card-border);
        }

        .btn-secondary:hover {
            color: white;
            border-color: rgba(255, 255, 255, 0.3);
        }

        /* Settings Icon */
        .config-toggle {
            position: fixed;
            bottom: 20px;
            left: 20px;
            color: var(--text-muted);
            cursor: pointer;
            background: var(--card);
            border: 1px solid var(--card-border);
            width: 40px;
            height: 40px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Connection / Success Overlay */
        #configOverlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            z-index: 100;
            align-items: center;
            justify-content: center;
        }

        .config-card {
            background: var(--card);
            border: 1px solid var(--card-border);
            padding: 30px;
            border-radius: 20px;
            width: 90%;
            max-width: 400px;
        }

        .response-toast {
            margin-top: 20px;
            padding: 15px;
            border-radius: 12px;
            display: none;
            font-family: monospace;
            font-size: 0.85rem;
        }

        .success {
            background: rgba(34, 197, 94, 0.1);
            color: #4ade80;
            border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .error {
            background: rgba(239, 68, 68, 0.1);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .section-divider {
            width: 100%;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--card-border), transparent);
        }

        .hidden {
            display: none !important;
        }

        /* Support Wizard Styles */
        #support-wizard .step {
            display: none;
        }

        #support-wizard .step.active {
            display: block;
            animation: slideUp 0.5s ease-out;
        }
    </style>
</head>

<body>
    <div class="container" id="documentation">
        <div class="header">
            <h1 style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 5px;">
                <i class="fa-solid fa-globe" style="color: var(--primary);"></i> API Integration
            </h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Dokumentation zum Anschluss externer Websites an das CRM.</p>
        </div>

        <div class="doc-card" style="border-left: 4px solid var(--primary); background: rgba(59, 130, 246, 0.05);">
            <h2><i class="fa-solid fa-code"></i> API Funktionsweise</h2>
            <p>Die API ermöglicht es Ihrer Website, über Standard-HTTP-Anfragen mit dem CRM zu kommunizieren.</p>
            <p style="margin-top: 10px; font-weight: 500; color: white;">Wichtige Integrationsschritte:</p>
            <ul style="margin-top: 5px; padding-left: 20px; color: var(--text-muted); font-size: 0.9rem;">
                <li><strong>Verbindung:</strong> Verwenden Sie Ihren persönlichen API-Key im Header.</li>
                <li><strong>Dynamik:</strong> Abrufen von Kategorien zur автоматических Aktualisierung des Formulars.</li>
                <li><strong>Datenübermittlung:</strong> Automatische Erstellung von Leads oder Tickets.</li>
            </ul>
        </div>

        <div class="doc-card">
            <h2>1. Authentifizierung</h2>
            <p>Alle Anfragen müssen Ihren persönlichen API-Key enthalten. Fügen Sie diesen im Header Ihrer HTTP-Anfrage hinzu:</p>
            <div class="code-block">x-api-key: IHR_API_KEY</div>
        </div>

        <div class="doc-card">
            <h2>2. Smart Forms (Leads)</h2>
            <p>Senden Sie Leads aus Ihren Sales Funnels direkt in das CRM.</p>
            <p><span class="badge badge-post">POST</span> <span style="font-family: monospace;">/inquiries</span></p>
            <div class="code-block">{
  "title": "Neue Website-Anfrage",
  "category_id": 1,
  "contact_name": "Max Mustermann",
  "contact_email": "max@beispiel.de",
  "source_website": "ihre-website.de",
  "answers": [
    { "question_id": 1, "answer_value": "Ja" }
  ]
}</div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px;">* <strong>source_website:</strong>
                Optionaler Parameter zur Verfolgung der Herkunft der Anfrage. Falls nicht angegeben, wird die IP des Absenders dennoch vom System gespeichert.</p>
        </div>

        <div class="doc-card">
            <h2>3. Support (Tickets)</h2>
            <p>Ermöglichen Sie Ihren Kunden, Support-Tickets direkt zu erstellen.</p>
            <p><span class="badge badge-post">POST</span> <span style="font-family: monospace;">/support</span></p>
            <div class="code-block">{
  "subject": "Heizungsproblem",
  "description": "Die Heizung im 2. Stock wird nicht mehr warm. Bitte prüfen.",
  "client_name": "Anna Schmidt",
  "client_email": "anna@beispiel.de"
}</div>
        </div>

        <div class="doc-card">
            <h2>4. Kategorien abrufen</h2>
            <p>Abrufen einer Liste von Kategorien, Unterkategorien und Fragen für dynamische Formulare direkt aus dem CRM.</p>
            <p><span class="badge badge-get">GET</span> <span style="font-family: monospace;">/categories</span></p>
        </div>
    </div>

    <div class="container">
        <div class="close-btn"><i class="fa-solid fa-xmark"></i></div>

        <div class="header">
            <div class="progress-container">
                <div id="progressBar" class="progress-bar"></div>
            </div>
            <span id="stepNumber" class="step-label">Schritt 1</span>
            <h1 id="stepTitle">Wie können wir Ihnen helfen?</h1>
        </div>

        <!-- Step 1: Category Selection -->
        <div id="step-category" class="step active">
            <div id="categoriesGrid" class="grid-options">
                <div style="text-align: center; grid-column: 1/-1; opacity: 0.5;">
                    <i class="fa-solid fa-circle-notch fa-spin"></i><br>Kategorien werden geladen...
                </div>
            </div>
        </div>

        <!-- Dynamic Content (Subcategories & Questions) -->
        <div id="dynamicContainer"></div>

        <!-- Final Step: Contact Details -->
        <div id="step-contact" class="step">
            <div class="form-group"><label>Name / Firma *</label><input type="text" id="contactName"
                    placeholder="Max Mustermann"></div>
            <div class="form-group"><label>E-Mail</label><input type="email" id="contactEmail"
                    placeholder="max@beispiel.de"></div>
            <div class="form-group"><label>Telefon</label><input type="tel" id="contactPhone"
                    placeholder="0172 1234567"></div>
            <div class="form-group"><label>Notizen</label><textarea id="contactNotes" rows="3"
                    placeholder="Ihre Nachricht..."></textarea></div>
        </div>

        <div class="actions">
            <button id="btnPrev" class="btn-secondary hidden" onclick="prevStep()">Zurück</button>
            <button id="btnNext" class="btn-primary" onclick="nextStep()" disabled>Weiter</button>
            <button id="btnSubmit" class="btn-primary hidden" onclick="submitInquiry()">Anfrage senden</button>
        </div>

        <div id="responseMsg" class="response-toast"></div>
    </div>

    <!-- Section Divider -->
    <div class="section-divider"></div>

    <!-- Support Wizard Container -->
    <div class="container" id="support-wizard">
        <div class="header">
            <div class="progress-container">
                <div id="progressBarSup" class="progress-bar"></div>
            </div>
            <span id="stepNumberSup" class="step-label">Support — Schritt 1</span>
            <h1 id="stepTitleSup">Technischer Support</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Helfen Sie uns, Ihr Anliegen schneller zu bearbeiten.</p>
        </div>

        <!-- Step 1: Topic -->
        <div id="step-sup-1" class="step active">
            <div class="grid-options">
                <div class="card-option" onclick="selectSupTopic('Software-Problem', this)">
                    <i class="fa-solid fa-bug"></i>
                    <h3>Software-Problem</h3>
                </div>
                <div class="card-option" onclick="selectSupTopic('Benutzerfrage / Hilfe', this)">
                    <i class="fa-solid fa-circle-question"></i>
                    <h3>Benutzerfrage / Hilfe</h3>
                </div>
                <div class="card-option" onclick="selectSupTopic('Defektmeldung', this)">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h3>Defektmeldung</h3>
                </div>
                <div class="card-option" onclick="selectSupTopic('Sonstiges', this)">
                    <i class="fa-solid fa-ellipsis"></i>
                    <h3>Sonstiges</h3>
                </div>
            </div>
        </div>

        <!-- Step 2: Description -->
        <div id="step-sup-2" class="step">
            <div class="form-group">
                <label>Betreff *</label>
                <input type="text" id="supSubject" placeholder="Kurztitel...">
            </div>
            <div class="form-group">
                <label>Detaillierte Beschreibung *</label>
                <textarea id="supDesc" rows="5" placeholder="Beschreiben Sie das Problem..."></textarea>
            </div>
        </div>

        <!-- Step 3: Client Info -->
        <div id="step-sup-3" class="step">
            <div class="form-group"><label>Ihr Name *</label><input type="text" id="supName"
                    placeholder="Max Mustermann"></div>
            <div class="form-group"><label>E-Mail Adresse *</label><input type="email" id="supEmail"
                    placeholder="max@beispiel.de"></div>
            <div class="form-group">
                <label>Priorität</label>
                <select id="supPriority">
                    <option value="low">Niedrig</option>
                    <option value="normal" selected>Normal</option>
                    <option value="high">Hoch</option>
                    <option value="urgent">Dringend</option>
                </select>
            </div>
        </div>

        <div class="actions">
            <button id="btnPrevSup" class="btn-secondary hidden" onclick="prevStepSup()">Zurück</button>
            <button id="btnNextSup" class="btn-primary" onclick="nextStepSup()" disabled>Weiter</button>
            <button id="btnSubmitSup" class="btn-primary hidden" onclick="submitSupport()">Ticket senden</button>
        </div>

        <div id="responseMsgSup" class="response-toast"></div>
    </div>

    <!-- Floating Config Button -->
    <div class="config-toggle" onclick="toggleConfig()"><i class="fa-solid fa-gear"></i></div>

    <!-- Hidden Config UI -->
    <div id="configOverlay">
        <div class="config-card">
            <h2 style="margin-bottom: 20px;">API-Verbindung</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">
                Stellen Sie sicher, dass Ihr Backend läuft und CORS erlaubt ist.
            </p>
            <div class="form-group">
                <label>API Basis-URL</label>
                <input type="text" id="apiUrl" value="https://admin.empire-premium.de/api/v1">
            </div>
            <div class="form-group">
                <label>API Key (x-api-key)</label>
                <input type="password" id="apiKey" value="">
            </div>
            <button class="btn-primary" onclick="saveAndReload()">Prüfen & Laden</button>
            <button class="btn-secondary" style="margin-top: 10px;" onclick="toggleConfig()">Schließen</button>
        </div>
    </div>
    <script>
        // --- State ---
        let allCategories = [];
        let state = {
            view: 'category', // category, subcategory, question, contact
            history: [],
            categoryId: null,
            subcategoryId: null,
            currentQuestionId: null,
            answers: {}, // qId -> { value, answerId }
            checkboxSelections: []
        };

        let supState = {
            currentIndex: 0,
            topic: '',
            steps: ['step-sup-1', 'step-sup-2', 'step-sup-3']
        };

        // --- Init ---
        async function loadCategories() {
            const url = document.getElementById('apiUrl').value;
            const key = document.getElementById('apiKey').value;
            const resGrid = document.getElementById('categoriesGrid');

            if (!url) return;

            resGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; opacity: 0.5;"><i class="fa-solid fa-circle-notch fa-spin"></i><br>Kategorien werden geladen...</div>';

            try {
                const response = await fetch(url + '/categories', {
                    headers: { 'x-api-key': key }
                });
                if (!response.ok) throw new Error('CORS oder falsche Route');
                const json = await response.json();
                allCategories = json.data?.categories || json.data || json;
                renderCategories();
            } catch (e) {
                resGrid.innerHTML = \`<div style="color:#f87171; text-align:center; grid-column:1/-1;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
                    <strong>API nicht erreichbar.</strong><br>
                    <span style="font-size: 0.85rem; opacity: 0.7;">Prüfen Sie die API-URL in den Einstellungen (unten links).</span>
                </div>\`;
            }
        }

        function renderCategories() {
            const grid = document.getElementById('categoriesGrid');
            grid.innerHTML = '';

            allCategories.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).forEach(cat => {
                const card = document.createElement('div');
                card.className = 'card-option' + (String(state.categoryId) === String(cat.id) ? ' selected' : '');

                let icon = cat.icon || 'fa-bolt';
                if (!cat.icon) {
                    if (cat.name.toLowerCase().includes('pv') || cat.name.toLowerCase().includes('solar')) icon = 'fa-solar-panel';
                    if (cat.name.toLowerCase().includes('wärme') || cat.name.toLowerCase().includes('pump')) icon = 'fa-fire-burner';
                }

                card.innerHTML = \`<i class="fa-solid \${icon}"></i><h3>\${cat.name}</h3>\`;
                card.onclick = () => selectCategory(cat);
                grid.appendChild(card);
            });
        }

        function selectCategory(cat) {
            state.categoryId = cat.id;
            state.subcategoryId = null;
            state.answers = {};
            state.history = ['category'];

            if (cat.subcategories && cat.subcategories.length > 0) {
                state.view = 'subcategory';
                renderSubcategories(cat);
            } else {
                state.view = 'contact';
            }
            updateUI();
        }

        function renderSubcategories(cat) {
            const dyn = document.getElementById('dynamicContainer');
            dyn.innerHTML = \`<div id="step-subcategory" class="step"><div class="grid-options" id="subGrid"></div></div>\`;
            const grid = dyn.querySelector('#subGrid');

            [...cat.subcategories].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).forEach(sub => {
                const card = document.createElement('div');
                card.className = 'card-option' + (String(state.subcategoryId) === String(sub.id) ? ' selected' : '');
                card.innerHTML = \`<i class="fa-solid fa-ellipsis"></i><h3>\${sub.name}</h3>\`;
                card.onclick = () => selectSubcategory(sub);
                grid.appendChild(card);
            });
        }

        function selectSubcategory(sub) {
            state.subcategoryId = sub.id;
            state.history.push('subcategory');

            if (sub.questions && sub.questions.length > 0) {
                state.view = 'question';
                state.currentQuestionId = sub.questions.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))[0].id;
                renderQuestion();
            } else {
                state.view = 'contact';
            }
            updateUI();
        }

        function renderQuestion() {
            const cat = allCategories.find(c => String(c.id) === String(state.categoryId));
            const sub = cat?.subcategories?.find(s => String(s.id) === String(state.subcategoryId));
            const q = sub?.questions?.find(qx => String(qx.id) === String(state.currentQuestionId));

            if (!q) { state.view = 'contact'; updateUI(); return; }

            const dyn = document.getElementById('dynamicContainer');
            dyn.innerHTML = \`<div id="step-q" class="step">
                <div class="grid-options" id="ansGrid"></div>
                <div id="qActions" class="actions hidden" style="margin-top:20px">
                    <button class="btn-primary" onclick="submitMultiSelection()">Weiter</button>
                </div>
                <div id="txtWrap" class="form-group hidden" style="margin-top:20px">
                    <input type="text" id="txtInput" placeholder="Ihre Antwort..." onkeydown="if(event.key==='Enter') submitTextSelection(this.value)">
                    <button class="btn-primary" style="margin-top:10px" onclick="submitTextSelection(document.getElementById('txtInput').value)">Weiter</button>
                </div>
            </div>\`;

            const grid = dyn.querySelector('#ansGrid');
            const type = q.type || 'radio';

            if (['radio', 'select', 'buttons'].includes(type) && q.answers) {
                q.answers.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).forEach(ans => {
                    const card = document.createElement('div');
                    card.className = 'card-option' + (state.answers[q.id]?.answerId === ans.id ? ' selected' : '');
                    card.innerHTML = \`<i class="fa-solid fa-check"></i><h3>\${ans.answer_text}</h3>\`;
                    card.onclick = () => handleAnswer(q, ans.answer_text, ans.id, ans.next_question_id);
                    grid.appendChild(card);
                });
            } else if (type === 'checkbox' && q.answers) {
                dyn.querySelector('#qActions').classList.remove('hidden');
                state.checkboxSelections = state.answers[q.id]?.checkedIds || [];
                q.answers.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).forEach(ans => {
                    const card = document.createElement('div');
                    const isChecked = state.checkboxSelections.includes(ans.id);
                    card.className = 'card-option' + (isChecked ? ' selected' : '');
                    card.innerHTML = \`<i class="fa-solid \${isChecked ? 'fa-square-check' : 'fa-square'}"></i><h3>\${ans.answer_text}</h3>\`;
                    card.onclick = () => {
                        const idx = state.checkboxSelections.indexOf(ans.id);
                        if (idx > -1) state.checkboxSelections.splice(idx, 1);
                        else state.checkboxSelections.push(ans.id);
                        card.classList.toggle('selected');
                        card.querySelector('i').className = card.classList.contains('selected') ? 'fa-solid fa-square-check' : 'fa-solid fa-square';
                    };
                    grid.appendChild(card);
                });
            } else if (type === 'input' || type === 'text') {
                dyn.querySelector('#txtWrap').classList.remove('hidden');
                if (state.answers[q.id]) dyn.querySelector('#txtInput').value = state.answers[q.id].value;
            }
            updateUI();
        }

        function handleAnswer(q, text, answerId, nextId) {
            state.answers[q.id] = { value: text, answerId: answerId };
            state.history.push({ view: 'question', qId: q.id });

            if (nextId) {
                state.currentQuestionId = nextId;
                renderQuestion();
            } else {
                state.view = 'contact';
            }
            updateUI();
        }

        function submitMultiSelection() {
            const qId = state.currentQuestionId;
            const cat = allCategories.find(c => String(c.id) === String(state.categoryId));
            const sub = cat.subcategories.find(s => String(s.id) === String(state.subcategoryId));
            const q = sub.questions.find(qx => String(qx.id) === String(qId));

            const selectedText = q.answers.filter(a => state.checkboxSelections.includes(a.id)).map(a => a.answer_text).join(', ');
            state.answers[qId] = { value: selectedText, checkedIds: [...state.checkboxSelections] };

            state.history.push({ view: 'question', qId: qId });

            const nextId = q.answers.find(a => state.checkboxSelections.includes(a.id))?.next_question_id;
            if (nextId) {
                state.currentQuestionId = nextId;
                renderQuestion();
            } else {
                state.view = 'contact';
            }
            updateUI();
        }

        function submitTextSelection(val) {
            if (!val.trim()) return;
            state.answers[state.currentQuestionId] = { value: val };
            state.history.push({ view: 'question', qId: state.currentQuestionId });
            state.view = 'contact';
            updateUI();
        }

        function nextStep() {
            if (state.view === 'category' && state.categoryId) selectCategory(allCategories.find(c => c.id === state.categoryId));
        }

        function prevStep() {
            if (state.history.length === 0) return;
            const last = state.history.pop();

            if (last === 'category') {
                state.view = 'category';
            } else if (last === 'subcategory') {
                state.view = 'subcategory';
                const cat = allCategories.find(c => String(c.id) === String(state.categoryId));
                renderSubcategories(cat);
            } else if (typeof last === 'object' && last.view === 'question') {
                state.view = 'question';
                state.currentQuestionId = last.qId;
                renderQuestion();
            }
            updateUI();
        }

        function updateUI() {
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

            document.getElementById('step-category').classList.toggle('active', state.view === 'category');
            document.getElementById('step-contact').classList.toggle('active', state.view === 'contact');

            const subStep = document.getElementById('step-subcategory');
            if (subStep) subStep.classList.toggle('active', state.view === 'subcategory');

            const qStep = document.getElementById('step-q');
            if (qStep) qStep.classList.toggle('active', state.view === 'question');

            let title = 'Wie können wir Ihnen helfen?';
            let stepText = 'Schritt 1';
            let progress = 10;

            if (state.view === 'subcategory') {
                title = 'Präzisieren Sie Ihre Anfrage';
                stepText = 'Schritt 2';
                progress = 30;
            } else if (state.view === 'question') {
                const cat = allCategories.find(c => String(c.id) === String(state.categoryId));
                const sub = cat?.subcategories?.find(s => String(s.id) === String(state.subcategoryId));
                const q = sub?.questions?.find(qx => String(qx.id) === String(state.currentQuestionId));
                title = q?.question_text || 'Frage';
                stepText = 'Frage';
                progress = 60;
            } else if (state.view === 'contact') {
                title = 'Ihre Kontaktdaten';
                stepText = 'Abschluss';
                progress = 90;
            }

            document.getElementById('stepTitle').innerText = title;
            document.getElementById('stepNumber').innerText = stepText;
            document.getElementById('progressBar').style.width = progress + '%';

            document.getElementById('btnPrev').classList.toggle('hidden', state.view === 'category');
            document.getElementById('btnSubmit').classList.toggle('hidden', state.view !== 'contact');
            document.getElementById('btnNext').classList.add('hidden');
        }

        function selectSupTopic(topic, el) {
            document.querySelectorAll('#step-sup-1 .card-option').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            supState.topic = topic;
            document.getElementById('supSubject').value = topic + ': ';
            document.getElementById('btnNextSup').disabled = false;
            setTimeout(nextStepSup, 150);
        }

        function updateUISup() {
            document.querySelectorAll('#support-wizard .step').forEach(s => s.classList.remove('active'));
            const sid = supState.steps[supState.currentIndex];
            document.getElementById(sid).classList.add('active');

            document.getElementById('stepNumberSup').innerText = \`Support — Schritt \${supState.currentIndex + 1}\`;
            let title = 'Technischer Support';
            if (sid === 'step-sup-2') title = 'Problembeschreibung';
            if (sid === 'step-sup-3') title = 'Ihre Kontaktdaten';
            document.getElementById('stepTitleSup').innerText = title;

            const perc = ((supState.currentIndex) / (supState.steps.length - 1)) * 100;
            document.getElementById('progressBarSup').style.width = \`\${Math.max(perc, 10)}%\`;

            document.getElementById('btnPrevSup').classList.toggle('hidden', supState.currentIndex === 0);
            const isLast = supState.currentIndex === supState.steps.length - 1;
            document.getElementById('btnNextSup').classList.toggle('hidden', isLast);
            document.getElementById('btnSubmitSup').classList.toggle('hidden', !isLast);

            if (sid === 'step-sup-1') document.getElementById('btnNextSup').disabled = !supState.topic;
            else document.getElementById('btnNextSup').disabled = false;
        }

        function nextStepSup() {
            if (supState.currentIndex < supState.steps.length - 1) {
                supState.currentIndex++;
                updateUISup();
            }
        }

        function prevStepSup() {
            if (supState.currentIndex > 0) {
                supState.currentIndex--;
                updateUISup();
            }
        }

        function toggleConfig() {
            const el = document.getElementById('configOverlay');
            el.style.display = el.style.display === 'flex' ? 'none' : 'flex';
        }

        function saveAndReload() {
            toggleConfig();
            loadCategories();
        }

        async function submitInquiry() {
            const btn = document.getElementById('btnSubmit');
            const msg = document.getElementById('responseMsg');
            const url = document.getElementById('apiUrl').value + '/inquiries';
            const key = document.getElementById('apiKey').value;

            if (!key) { alert('Bitte geben Sie den API-Key in den Einstellungen an!'); return; }

            btn.disabled = true;
            btn.innerText = 'Wird gesendet...';
            msg.style.display = 'block';
            msg.className = 'response-toast';
            msg.innerText = 'Bitte warten...';

            const payload = {
                title: 'Website-Anfrage',
                category_id: state.categoryId,
                subcategory_id: state.subcategoryId,
                contact_name: document.getElementById('contactName').value,
                contact_email: document.getElementById('contactEmail').value,
                contact_phone: document.getElementById('contactPhone').value,
                notes: document.getElementById('contactNotes').value,
                source_website: window.location.hostname,
                answers: Object.keys(state.answers).map(qId => ({
                    question_id: parseInt(qId),
                    answer_id: state.answers[qId].answerId,
                    answer_value: state.answers[qId].value
                }))
            };

            try {
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                    body: JSON.stringify(payload)
                });
                const res = await r.json();
                if (r.ok) {
                    msg.className = 'response-toast success';
                    msg.innerText = 'Erfolg! Vielen Dank für Ihre Nachricht.';
                    btn.innerText = 'Gesendet';
                } else {
                    throw new Error(res.message || 'Fehler beim Senden.');
                }
            } catch (e) {
                msg.className = 'response-toast error';
                msg.innerText = 'Fehler: ' + e.message;
                btn.disabled = false;
                btn.innerText = 'Erneut versuchen';
            }
        }

        async function submitSupport() {
            const btn = document.getElementById('btnSubmitSup');
            const msg = document.getElementById('responseMsgSup');
            const url = document.getElementById('apiUrl').value + '/support';
            const key = document.getElementById('apiKey').value;

            if (!key) { alert('Bitte geben Sie den API-Key in den Einstellungen an!'); return; }

            const payload = {
                subject: document.getElementById('supSubject').value,
                description: document.getElementById('supDesc').value,
                client_name: document.getElementById('supName').value,
                client_email: document.getElementById('supEmail').value,
                priority: document.getElementById('supPriority').value
            };

            if (!payload.subject || !payload.description || !payload.client_name) {
                alert('Bitte füllen Sie alle Pflichtfelder aus!'); return;
            }

            btn.disabled = true;
            btn.innerText = 'Wird gesendet...';
            msg.style.display = 'block';
            msg.className = 'response-toast';
            msg.innerText = 'Bitte warten...';

            try {
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                    body: JSON.stringify(payload)
                });
                const res = await r.json();
                if (r.ok) {
                    msg.className = 'response-toast success';
                    msg.innerText = 'Support-Ticket успешно erstellt.';
                    btn.innerText = 'Ticket gesendet';
                } else {
                    throw new Error(res.message || 'Fehler beim Senden.');
                }
            } catch (e) {
                msg.className = 'response-toast error';
                msg.innerText = 'Fehler: ' + e.message;
                btn.disabled = false;
                btn.innerText = 'Erneut versuchen';
            }
        }

        window.onload = loadCategories;
    </script>
</body>

</html>`;

const CodeBlock = ({ code, language = 'json' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group mt-4 mb-6 rounded-xl overflow-hidden border border-white/10 bg-[#0d1117]">
            <div className="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/10">
                <span className="text-xs font-mono text-gray-400">{language.toUpperCase()}</span>
                <button
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
                >
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Kopiert' : 'Kopieren'}
                </button>
            </div>
            <div className="p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
};

const ApiIntegration = () => {
    const { user } = useSelector((state) => state.auth);
    const companyId = user?.company_id || 'IHR_COMPANY_ID';
    const baseUrl = `${window.location.origin}/api/v1`;

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Globe className="w-8 h-8 text-blue-400" />
                        API Integration
                    </h1>
                    <p className="text-gray-400">
                        Dokumentation zum Anschluss externer Websites (WordPress, Next.js usw.) an dieses CRM.
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Documentation Summary Section */}
                    <section className="card p-6 border-l-4 border-blue-500 bg-blue-500/5">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Code className="w-5 h-5 text-blue-400" />
                            API Funktionsweise
                        </h2>
                        <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                            <p>
                                Die API ermöglicht es Ihrer Website, über Standard-HTTP-Anfragen mit dem CRM zu kommunizieren.
                                Wichtige Integrationsschritte:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-2">
                                <li><strong className="text-white">Verbindung:</strong> Verwenden Sie Ihren persönlichen API-Key im Request-Header.</li>
                                <li><strong className="text-white">Dynamik:</strong> Sie können Kategorien und Fragen abrufen, damit Formulare auf Ihrer Website automatisch aktualisiert werden.</li>
                                <li><strong className="text-white">Datenübermittlung:</strong> Nach dem Ausfüllen werden die Daten an das CRM gesendet, wo automatisch ein Lead (Inquiry) или Ticket (Support) erstellt wird.</li>
                            </ul>
                        </div>
                    </section>
                    {/* Authentication Section */}
                    <section className="card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400">
                                <Server className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-white">1. Authentifizierung</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            Alle Anfragen müssen Ihren persönlichen <strong className="text-white">API-Key</strong> enthalten.
                            Dieser kann im Bereich "Einstellungen  API-Keys" generiert werden.
                        </p>
                        <p className="text-gray-300">
                            Fügen Sie den Key im Header Ihrer HTTP-Anfrage hinzu:
                        </p>
                        <CodeBlock
                            language="http"
                            code={`# Empfohlener Header\\nx-api-key: IHR_API_KEY`}
                        />
                    </section>

                    {/* Funnelforms / Inquiries Section */}
                    <section className="card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                                <Code className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-white">2. Smart Forms (Leads)</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            Senden Sie Leads aus Ihren Sales Funnels direkt in das CRM.
                        </p>

                        <div className="mb-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/20 text-green-400 font-mono text-sm border border-green-500/30">
                                <span className="font-bold">POST</span> {baseUrl}/inquiries
                            </span>
                        </div>

                        <h3 className="font-semibold text-white mb-2 mt-6">Beispiel-Anfrage (JSON)</h3>
                        <CodeBlock
                            language="json"
                            code={`{
  "title": "Neue Website-Anfrage",
  "category_id": 1,
  "subcategory_id": 2,
  "contact_name": "Max Mustermann",
  "contact_email": "max@beispiel.de",
  "contact_phone": "+49 123 456789",
  "location": "Musterstraße 1, 12345 Stadt",
  "notes": "Interesse an schneller Umsetzung",
  
  "answers": [
    {
      "question_id": 1,
      "answer_id": 5,
      "answer_value": "Ja"
    },
    {
      "question_id": 2,
      "answer_value": "Ca. 50 qm"
    }
  ],
  "source_website": "ihre-website.de"
}`}
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            * Die Felder <code className="text-blue-300">category_id</code> und <code className="text-blue-300">contact_name</code> sind Pflichtfelder. <code className="text-blue-300">source_website</code> ist optional und wird zur Verfolgung der Herkunft genutzt. Die IP-Adresse des Absenders wird ebenfalls automatisch vom System gespeichert.
                        </p>
                    </section>

                    {/* Support Tickets Section */}
                    <section className="card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-400">
                                <Terminal className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-white">3. Support (Tickets)</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            Ermöglichen Sie Ihren Kunden, Support-Tickets direkt von externen Portalen zu erstellen.
                        </p>

                        <div className="mb-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/20 text-green-400 font-mono text-sm border border-green-500/30">
                                <span className="font-bold">POST</span> {baseUrl}/support
                            </span>
                        </div>

                        <h3 className="font-semibold text-white mb-2 mt-6">Beispiel-Anfrage (JSON)</h3>
                        <CodeBlock
                            language="json"
                            code={`{
  "subject": "Heizungsproblem",
  "description": "Heizung im 2. Stock wird nicht warm. Bitte prüfen.",
  "priority": "high",
  "client_name": "Anna Schmidt",
  "client_email": "anna@beispiel.de",
  "client_phone": "0172 9876543",
  "project_id": "optional-uuid-here"
}`}
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            * Die Felder <code className="text-blue-300">subject</code> und <code className="text-blue-300">description</code> sind Pflichtfelder. Zulässige Werte für <code className="text-blue-300">priority</code>: low, normal, high, urgent.
                        </p>
                    </section>

                    {/* Bewerbungen Section */}
                    <section className="card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400">
                                <Briefcase className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-white">4. Bewerbungen (Kurzbewerbungen)</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            Binden Sie Bewerbungsformulare auf Ihrer Karriere- oder Landingpage ein, um Bewerbungen direkt ins CRM zu leiten.
                        </p>

                        <div className="mb-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/20 text-green-400 font-mono text-sm border border-green-500/30">
                                <span className="font-bold">POST</span> {baseUrl}/bewerbungen/public/{companyId}
                            </span>
                        </div>

                        <h3 className="font-semibold text-white mb-2 mt-6">Beispiel-Anfrage (JSON)</h3>
                        <CodeBlock
                            language="json"
                            code={`{
  "stelle": "Bauleiter (m/w/d)",
  "email": "max.mustermann@web.de",
  "telefon": "+49 176 98765432",
  "erfahrung": "Mehrere Jahre Erfahrung im Hochbau...",
  "nachricht": "Hallo Empire-Team, anbei meine Bewerbung..." // Optional
}`}
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            * Die Felder <code className="text-blue-300">stelle</code>, <code className="text-blue-300">email</code>, <code className="text-blue-300">telefon</code> und <code className="text-blue-300">erfahrung</code> sind Pflichtfelder. Das Feld <code className="text-blue-300">nachricht</code> ist optional. Stellen Sie sicher, dass Sie den Header <code className="text-blue-300">x-api-key</code> mit Ihrem gültigen API-Schlüssel mitsenden, um die Anfrage zu autorisieren.
                        </p>
                    </section>

                    {/* Fetching Categories Section */}
                    <section className="card p-6 text-gray-300">
                        <div className="flex items-center gap-3 mb-4 text-white">
                            <h2 className="text-xl font-bold">5. Kategorien für Formulare abrufen</h2>
                        </div>
                        <p className="mb-4">
                            Wenn Sie dynamische Formulare bauen möchten, können Sie die Liste der Kategorien, Unterkategorien und Fragen direkt aus dem CRM abrufen.
                        </p>

                        <div className="mb-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 font-mono text-sm border border-blue-500/30">
                                <span className="font-bold">GET</span> {baseUrl}/categories
                            </span>
                        </div>
                    </section>

                    {/* Example HTML Form Download */}
                    <section className="card p-6 border border-blue-500/30 bg-blue-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                                <Code className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Fertige HTML-Vorlage</h2>
                        </div>
                        <p className="text-gray-300 mb-6 max-w-2xl">
                            Laden Sie eine fertige Datei mit vollständig konfigurierten Skripten herunter. Die Logik für "Smart Forms" und "Tickets" ist bereits implementiert. Passen Sie einfach den API-Key in den Einstellungen der Datei an und binden Sie diese auf Ihrer Seite ein.
                        </p>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    const element = document.createElement("a");
                                    const file = new Blob([htmlTemplate], { type: 'text/html' });
                                    element.href = URL.createObjectURL(file);
                                    element.download = "api_integration_template.html";
                                    document.body.appendChild(element);
                                    element.click();
                                    document.body.removeChild(element);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 text-white w-full px-6 py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 font-medium"
                            >
                                <Download className="w-5 h-5" />
                                HTML-Datei herunterladen
                            </button>

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(htmlTemplate);
                                }}
                                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 w-full px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-medium"
                            >
                                <Copy className="w-5 h-5 text-gray-400" />
                                Code kopieren
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ApiIntegration;
