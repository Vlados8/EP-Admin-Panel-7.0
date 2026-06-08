const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/vlado/Desktop/admin/frontend/src/features/projects/ProjectDetails.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace encodings
const replacements = [
    [/Г¤/g, 'ä'],
    [/Гј/g, 'ü'],
    [/Г¶/g, 'ö'],
    [/Гџ/g, 'ß'],
    [/Г„/g, 'Ä'],
    [/Гњ/g, 'Ü'],
    [/Г–/g, 'Ö'],
    [/В°/g, '°'],
    [/РїРѕРґС‚РІРµСЂРґРёС‚СЊ Рё РїСЂРѕРµРєС‚ Р°РєС‚РёРІРёСЂРѕРІР°С‚СЊ/g, 'bestätigen und das Projekt aktivieren'],
    [/Project СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°С\s+!/g, 'Projekt erfolgreich aktiviert!'],
    [/Project СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°С\s\s!/g, 'Projekt erfolgreich aktiviert!'],
    [/Project СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°С  !/g, 'Projekt erfolgreich aktiviert!'],
    [/Project СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°СЃ!/g, 'Projekt erfolgreich aktiviert!'],
    [/Project СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°С\.!/g, 'Projekt erfolgreich aktiviert!'],
    [/СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°С  /g, 'erfolgreich aktiviert'],
    [/СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°СЃ/g, 'erfolgreich aktiviert'],
    [/СѓСЃРїРµС€РЅРѕ Р°РєС‚РёРІРёСЂРѕРІР°С/g, 'erfolgreich aktiviert'],
    [/Рё РЅР°С‡Р°С‚СЊ СЂР°Р±РѕС‚Сѓ/g, 'und mit der Arbeit zu beginnen']
];

for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed ProjectDetails.jsx!');
