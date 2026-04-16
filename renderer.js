const { ipcRenderer } = require('electron');

// Estado da aplicação
const state = {
    pacPath: null,
    extractOutputDir: null,
    repackInputDir: null,
    repackOutputDir: null,
    isExtracting: false,
    isRepacking: false,
    pythonReady: false
};

// Elementos UI
const elements = {
    selectPacBtn: document.getElementById('selectPacBtn'),
    pacPath: document.getElementById('pacPath'),
    pacInfo: document.getElementById('pacInfo'),
    fileListContainer: document.getElementById('fileListContainer'),
    extractBtn: document.getElementById('extractBtn'),
    extractProgressFill: document.getElementById('extractProgressFill'),
    extractProgressText: document.getElementById('extractProgressText'),
    extractStatus: document.getElementById('extractStatus'),
    logArea: document.getElementById('logArea'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    selectFolderBtn: document.getElementById('selectFolderBtn'),
    repackFolderPath: document.getElementById('repackFolderPath'),
    repackFileList: document.getElementById('repackFileList'),
    selectOutputPacBtn: document.getElementById('selectOutputPacBtn'),
    repackOutputPath: document.getElementById('repackOutputPath'),
    startRepackBtn: document.getElementById('startRepackBtn'),
    repackProgressFill: document.getElementById('repackProgressFill'),
    repackProgressText: document.getElementById('repackProgressText'),
    repackStatus: document.getElementById('repackStatus'),
    globalStatus: document.getElementById('globalStatus'),
    notification: document.getElementById('notification'),
    minimizeBtn: document.getElementById('minimizeBtn'),
    maximizeBtn: document.getElementById('maximizeBtn'),
    closeBtn: document.getElementById('closeBtn')
};

// ========== Helpers ==========
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-message">${escapeHtml(message)}</span>`;
    elements.logArea.appendChild(entry);
    elements.logArea.scrollTop = elements.logArea.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type} show`;
    setTimeout(() => elements.notification.classList.remove('show'), 4000);
}

function setGlobalStatus(text) {
    elements.globalStatus.textContent = text;
}

function updateProgress(elementFill, elementText, percent) {
    elementFill.style.width = `${percent}%`;
    elementText.textContent = `${percent}%`;
}

function clearProgress(elementFill, elementText) {
    elementFill.style.width = '0%';
    elementText.textContent = '0%';
}

// ========== Controles da Janela ==========
elements.minimizeBtn.addEventListener('click', () => ipcRenderer.send('window-minimize'));
elements.maximizeBtn.addEventListener('click', () => ipcRenderer.send('window-maximize'));
elements.closeBtn.addEventListener('click', () => ipcRenderer.send('window-close'));

// ========== Python Status ==========
ipcRenderer.on('python-ready', (event, pythonPath) => {
    state.pythonReady = true;
    const displayPath = pythonPath.length > 40 ? '...' + pythonPath.slice(-37) : pythonPath;
    addLog(`🐍 Python configurado: ${displayPath}`, 'success');
    setGlobalStatus(`Pronto | Python: ${displayPath}`);
});

ipcRenderer.on('python-missing', () => {
    state.pythonReady = false;
    const msg = [
        '❌ Python não encontrado!',
        '',
        'Para usar este app você precisa instalar o Python:',
        '  • Windows: https://www.python.org/downloads/',
        '    ⚠️  Marque "Add Python to PATH" na instalação!',
        '  • Linux: sudo apt install python3',
        '  • macOS: brew install python3',
        '',
        'Após instalar, reinicie o aplicativo.'
    ].join('\n');

    addLog(msg, 'error');
    showNotification('Python não encontrado! Veja o log para instruções.', 'error');
    setGlobalStatus('❌ Python não encontrado');
});

// ========== Extração ==========
elements.selectPacBtn.addEventListener('click', async () => {
    if (state.isExtracting) return;
    const filePath = await ipcRenderer.invoke('select-pac-file');
    if (filePath) {
        state.pacPath = filePath;
        const fileName = filePath.split(/[\\/]/).pop();
        elements.pacPath.innerHTML = `<i class="fas fa-check-circle" style="color:#4caf50"></i><span title="${filePath}">${fileName}</span>`;
        elements.extractBtn.disabled = false;
        addLog(`📂 PAC selecionado: ${filePath}`, 'info');

        elements.pacInfo.style.display = 'flex';
        elements.pacInfo.innerHTML = `<i class="fas fa-microchip"></i><span>${fileName}</span>`;
        elements.fileListContainer.innerHTML = '<div class="file-item empty"><i class="fas fa-info-circle"></i><span>Clique em "Extrair PAC" para ver as partições</span></div>';
    }
});

elements.extractBtn.addEventListener('click', async () => {
    if (!state.pacPath || state.isExtracting) return;

    const outDir = await ipcRenderer.invoke('select-folder', 'Selecionar pasta de destino para extração');
    if (!outDir) return;
    state.extractOutputDir = outDir;

    state.isExtracting = true;
    elements.extractBtn.disabled = true;
    elements.selectPacBtn.disabled = true;
    clearProgress(elements.extractProgressFill, elements.extractProgressText);
    elements.extractStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Extraindo...</span>';
    setGlobalStatus('Extraindo PAC...');
    addLog(`🚀 Iniciando extração para: ${outDir}`, 'info');

    ipcRenderer.send('extract-pac', state.pacPath, outDir);
});

// ========== Empacotamento ==========
elements.selectFolderBtn.addEventListener('click', async () => {
    if (state.isRepacking) return;
    const folder = await ipcRenderer.invoke('select-folder', 'Selecionar pasta com as partições extraídas');
    if (folder) {
        state.repackInputDir = folder;
        const folderName = folder.split(/[\\/]/).pop();
        elements.repackFolderPath.innerHTML = `<i class="fas fa-check-circle" style="color:#4caf50"></i><span title="${folder}">${folderName}</span>`;
        addLog(`📂 Pasta de partições: ${folder}`, 'info');

        try {
            const files = await ipcRenderer.invoke('list-directory', folder);
            updateRepackFileList(files);
        } catch (e) {
            elements.repackFileList.innerHTML = '<div class="file-item empty"><i class="fas fa-folder-open"></i><span>Pasta selecionada</span></div>';
        }

        updateRepackButtonState();
    }
});

elements.selectOutputPacBtn.addEventListener('click', async () => {
    if (state.isRepacking) return;
    const folder = await ipcRenderer.invoke('select-folder', 'Selecionar pasta onde o PAC será salvo');
    if (folder) {
        state.repackOutputDir = folder;
        const folderName = folder.split(/[\\/]/).pop();
        elements.repackOutputPath.innerHTML = `<i class="fas fa-check-circle" style="color:#4caf50"></i><span title="${folder}">${folderName}</span>`;
        addLog(`📁 Pasta de destino: ${folder}`, 'info');
        updateRepackButtonState();
    }
});

function updateRepackButtonState() {
    elements.startRepackBtn.disabled = !(state.repackInputDir && state.repackOutputDir && !state.isRepacking);
}

function updateRepackFileList(files) {
    const fileItems = files.filter(f => !f.isDirectory);
    if (fileItems.length === 0) {
        elements.repackFileList.innerHTML = '<div class="file-item empty"><i class="fas fa-inbox"></i><span>Nenhum arquivo encontrado</span></div>';
        return;
    }
    const maxShow = 15;
    let html = fileItems.slice(0, maxShow).map(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        const icon = ext === 'xml' ? 'fa-code' : ext === 'img' ? 'fa-hdd' : ext === 'bin' ? 'fa-microchip' : 'fa-file';
        return `<div class="file-item"><i class="fas ${icon}"></i><span>${escapeHtml(f.name)}</span></div>`;
    }).join('');
    if (fileItems.length > maxShow) {
        html += `<div class="file-item"><i class="fas fa-ellipsis-h"></i><span>... e mais ${fileItems.length - maxShow} arquivos</span></div>`;
    }
    elements.repackFileList.innerHTML = html;
}

elements.startRepackBtn.addEventListener('click', () => {
    if (!state.repackInputDir || !state.repackOutputDir || state.isRepacking) return;

    state.isRepacking = true;
    elements.startRepackBtn.disabled = true;
    elements.selectFolderBtn.disabled = true;
    elements.selectOutputPacBtn.disabled = true;
    clearProgress(elements.repackProgressFill, elements.repackProgressText);
    elements.repackStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Empacotando...</span>';
    setGlobalStatus('Empacotando PAC...');
    addLog(`🚀 Iniciando empacotamento de: ${state.repackInputDir}`, 'info');
    addLog(`📁 PAC será salvo em: ${state.repackOutputDir}`, 'info');

    ipcRenderer.send('repack-pac', state.repackInputDir, state.repackOutputDir);
});

// ========== IPC: Extração ==========
ipcRenderer.on('extract-log', (event, { type, text }) => {
    addLog(text, type === 'stderr' ? 'error' : 'info');
});

ipcRenderer.on('extract-progress', (event, percent) => {
    updateProgress(elements.extractProgressFill, elements.extractProgressText, percent);
});

ipcRenderer.on('extract-complete', (event, { success, code }) => {
    state.isExtracting = false;
    elements.extractBtn.disabled = false;
    elements.selectPacBtn.disabled = false;

    if (success) {
        elements.extractStatus.innerHTML = '<i class="fas fa-check-circle" style="color:green"></i><span>Extração concluída!</span>';
        updateProgress(elements.extractProgressFill, elements.extractProgressText, 100);
        setGlobalStatus('Extração concluída ✅');
        showNotification('PAC extraído com sucesso!', 'success');
        addLog('✅ Extração finalizada com sucesso!', 'success');

        if (state.extractOutputDir) {
            ipcRenderer.invoke('list-directory', state.extractOutputDir).then(files => {
                const fileItems = files.filter(f => !f.isDirectory);
                if (fileItems.length > 0) {
                    const maxShow = 10;
                    let html = fileItems.slice(0, maxShow).map(f =>
                        `<div class="file-item"><i class="fas fa-file"></i><span>${escapeHtml(f.name)}</span></div>`
                    ).join('');
                    if (fileItems.length > maxShow) {
                        html += `<div class="file-item"><i class="fas fa-ellipsis-h"></i><span>... e mais ${fileItems.length - maxShow} arquivos</span></div>`;
                    }
                    elements.fileListContainer.innerHTML = html;
                }
            }).catch(() => {});
        }
    } else {
        elements.extractStatus.innerHTML = '<i class="fas fa-times-circle" style="color:red"></i><span>Falha na extração</span>';
        setGlobalStatus('Erro na extração ❌');
        showNotification('Falha ao extrair PAC', 'error');
        addLog(`❌ Extração falhou com código ${code}`, 'error');
    }
});

ipcRenderer.on('extract-error', (event, message) => {
    state.isExtracting = false;
    elements.extractBtn.disabled = false;
    elements.selectPacBtn.disabled = false;
    elements.extractStatus.innerHTML = '<i class="fas fa-times-circle" style="color:red"></i><span>Erro</span>';
    setGlobalStatus('Erro na extração ❌');
    showNotification('Erro na extração', 'error');
    addLog(`❌ Erro: ${message}`, 'error');
});

// ========== IPC: Empacotamento ==========
ipcRenderer.on('repack-log', (event, { type, text }) => {
    addLog(text, type === 'stderr' ? 'error' : 'info');
});

ipcRenderer.on('repack-progress', (event, percent) => {
    updateProgress(elements.repackProgressFill, elements.repackProgressText, percent);
});

ipcRenderer.on('repack-complete', (event, { success, code }) => {
    state.isRepacking = false;
    elements.startRepackBtn.disabled = false;
    elements.selectFolderBtn.disabled = false;
    elements.selectOutputPacBtn.disabled = false;
    updateRepackButtonState();

    if (success) {
        elements.repackStatus.innerHTML = '<i class="fas fa-check-circle" style="color:green"></i><span>Empacotado!</span>';
        updateProgress(elements.repackProgressFill, elements.repackProgressText, 100);
        setGlobalStatus('PAC criado com sucesso ✅');
        showNotification('PAC empacotado com sucesso!', 'success');
        addLog('✅ Empacotamento finalizado com sucesso!', 'success');
    } else {
        elements.repackStatus.innerHTML = '<i class="fas fa-times-circle" style="color:red"></i><span>Falha</span>';
        setGlobalStatus('Erro no empacotamento ❌');
        showNotification('Falha ao empacotar PAC', 'error');
        addLog(`❌ Empacotamento falhou com código ${code}`, 'error');
    }
});

ipcRenderer.on('repack-error', (event, message) => {
    state.isRepacking = false;
    elements.startRepackBtn.disabled = false;
    elements.selectFolderBtn.disabled = false;
    elements.selectOutputPacBtn.disabled = false;
    updateRepackButtonState();
    elements.repackStatus.innerHTML = '<i class="fas fa-times-circle" style="color:red"></i><span>Erro</span>';
    setGlobalStatus('Erro no empacotamento ❌');
    showNotification(`Erro: ${message}`, 'error');
    addLog(`❌ Erro: ${message}`, 'error');
});

// Limpar logs
elements.clearLogsBtn.addEventListener('click', () => {
    elements.logArea.innerHTML = '';
    addLog('Logs limpos.', 'info');
});

// Inicialização
addLog('🎉 Sistema pronto. Aguardando detecção do Python...', 'info');