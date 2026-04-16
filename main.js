const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

let mainWindow;

// ========== CAMINHO DOS SCRIPTS PYTHON ==========
// Funciona tanto em desenvolvimento quanto compilado com electron-builder
function getScriptPath(scriptName) {
    // Quando compilado, os arquivos extra ficam em resources/app ou resources/
    const possiblePaths = [
        // Desenvolvimento: mesmo diretório do main.js
        path.join(__dirname, scriptName),
        // Compilado electron-builder (extraResources)
        path.join(process.resourcesPath, scriptName),
        // Compilado electron-builder (asar extraído)
        path.join(process.resourcesPath, 'app', scriptName),
        path.join(process.resourcesPath, 'app.asar.unpacked', scriptName),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`✅ Script encontrado: ${p}`);
            return p;
        }
    }

    console.error(`❌ Script não encontrado: ${scriptName}`);
    console.error('Caminhos tentados:', possiblePaths);
    return null;
}

// Caminho para arquivo de configuração
const configPath = path.join(app.getPath('userData'), 'python-path.json');

// ========== CARREGAR/SALVAR CONFIGURAÇÃO ==========
function loadSavedPythonPath() {
    try {
        if (fs.existsSync(configPath)) {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (data.pythonPath && fs.existsSync(data.pythonPath)) {
                console.log(`📁 Python salvo: ${data.pythonPath}`);
                return data.pythonPath;
            }
        }
    } catch (e) {}
    return null;
}

function savePythonPath(pyPath) {
    try {
        fs.writeFileSync(configPath, JSON.stringify({ pythonPath: pyPath }));
        console.log(`💾 Python salvo: ${pyPath}`);
    } catch (e) {}
}

// ========== DETECÇÃO DO PYTHON ==========
function detectPython() {
    const isWindows = process.platform === 'win32';

    // Comandos para testar
    const commands = isWindows
        ? ['py', 'python', 'python3', 'python3.12', 'python3.11', 'python3.10', 'python3.9']
        : ['python3', 'python', 'python3.12', 'python3.11', 'python3.10'];

    for (const cmd of commands) {
        try {
            const result = execSync(`${cmd} --version`, {
                stdio: 'pipe',
                shell: true,
                timeout: 5000
            });
            const version = (result || '').toString().trim();
            console.log(`✅ Python encontrado: "${cmd}" -> ${version}`);
            return cmd;
        } catch (e) {}
    }

    // Busca em caminhos fixos (Windows)
    if (isWindows) {
        const userProfile = process.env.USERPROFILE || process.env.HOME || '';
        const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

        const searchPaths = [];
        for (const ver of ['312', '311', '310', '39', '38', '313']) {
            searchPaths.push(
                path.join(localAppData, 'Programs', 'Python', `Python${ver}`, 'python.exe'),
                path.join(programFiles, `Python${ver}`, 'python.exe'),
                path.join(programFilesX86, `Python${ver}`, 'python.exe'),
                `C:\\Python${ver}\\python.exe`,
                `C:\\Python${ver.slice(0, 2)}.${ver.slice(2)}\\python.exe`
            );
        }
        // Microsoft Store Python
        searchPaths.push(
            path.join(localAppData, 'Microsoft', 'WindowsApps', 'python.exe'),
            path.join(localAppData, 'Microsoft', 'WindowsApps', 'python3.exe')
        );

        for (const p of searchPaths) {
            try {
                if (fs.existsSync(p)) {
                    execSync(`"${p}" --version`, { stdio: 'pipe', timeout: 5000 });
                    console.log(`✅ Python encontrado: ${p}`);
                    return p;
                }
            } catch (e) {}
        }
    } else {
        // Linux/macOS
        const linuxPaths = [
            '/usr/bin/python3',
            '/usr/local/bin/python3',
            '/opt/homebrew/bin/python3',
            '/usr/bin/python',
        ];
        for (const p of linuxPaths) {
            try {
                if (fs.existsSync(p)) {
                    execSync(`"${p}" --version`, { stdio: 'pipe', timeout: 5000 });
                    console.log(`✅ Python encontrado: ${p}`);
                    return p;
                }
            } catch (e) {}
        }
    }

    return null;
}

async function getPythonCommand() {
    // 1. Caminho salvo pelo usuário
    const saved = loadSavedPythonPath();
    if (saved) return saved;

    // 2. Detecção automática
    const auto = detectPython();
    if (auto) return auto;

    // 3. Pede ao usuário selecionar manualmente
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Python não encontrado',
        message: 'O Python não foi localizado automaticamente.\n\nClique em "Selecionar" para localizar o python.exe manualmente, ou em "Instalar" para ir ao site do Python.',
        buttons: ['Selecionar...', 'Ir para python.org', 'Cancelar'],
        defaultId: 0
    });

    if (result.response === 0) {
        const filters = process.platform === 'win32'
            ? [{ name: 'Python', extensions: ['exe'] }]
            : [{ name: 'Todos os arquivos', extensions: ['*'] }];

        const fileResult = await dialog.showOpenDialog(mainWindow, {
            title: 'Selecione o executável do Python',
            filters,
            properties: ['openFile']
        });

        if (!fileResult.canceled && fileResult.filePaths.length > 0) {
            const selected = fileResult.filePaths[0];
            try {
                execSync(`"${selected}" --version`, { stdio: 'pipe', timeout: 5000 });
                savePythonPath(selected);
                return selected;
            } catch (e) {
                await dialog.showErrorBox('Erro', 'O arquivo selecionado não é um Python válido.');
            }
        }
    } else if (result.response === 1) {
        require('electron').shell.openExternal('https://www.python.org/downloads/');
    }

    return null;
}

// ========== JANELA PRINCIPAL ==========
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        // Tenta carregar ícone, mas não falha se não existir
        ...(fs.existsSync(path.join(__dirname, 'assets', 'icon.ico'))
            ? { icon: path.join(__dirname, 'assets', 'icon.ico') }
            : {})
    });

    mainWindow.loadFile('index.html');

    // Controles da janela
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    });
    ipcMain.on('window-close', () => mainWindow.close());

    // Detecta Python
    const pythonCmd = await getPythonCommand();

    if (!pythonCmd) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('python-missing');
        });
        mainWindow.webContents.send('python-missing');
    } else {
        console.log(`🐍 Python configurado: ${pythonCmd}`);
        // Avisa o renderer qual Python está sendo usado
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('python-ready', pythonCmd);
        });
    }

    // ========== IPC HANDLERS ==========
    ipcMain.handle('select-pac-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Selecionar arquivo PAC',
            filters: [{ name: 'PAC Firmware', extensions: ['pac'] }],
            properties: ['openFile']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('select-folder', async (event, title) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: title || 'Selecionar pasta',
            properties: ['openDirectory']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('list-directory', async (event, dirPath) => {
        try {
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return items.map(i => ({ name: i.name, isDirectory: i.isDirectory() }));
        } catch (e) {
            return [];
        }
    });

    // ========== EXTRAÇÃO ==========
    ipcMain.on('extract-pac', (event, pacPath, outputDir) => {
        if (!pythonCmd) {
            event.reply('extract-error', 'Python não configurado. Reinicie o app.');
            return;
        }

        const script = getScriptPath('extractor.py');
        if (!script) {
            event.reply('extract-error', 'Script extractor.py não encontrado! Verifique a instalação do app.');
            return;
        }

        const args = [script, pacPath, outputDir];
        console.log(`🚀 Executando: ${pythonCmd} ${args.join(' ')}`);
        runPythonScript(event, 'extract', pythonCmd, args, { cwd: outputDir });
    });

    // ========== EMPACOTAMENTO ==========
    ipcMain.on('repack-pac', (event, inputDir, outputDir) => {
        if (!pythonCmd) {
            event.reply('repack-error', 'Python não configurado. Reinicie o app.');
            return;
        }

        const script = getScriptPath('pack_pac_enhanced.py');
        if (!script) {
            event.reply('repack-error', 'Script pack_pac_enhanced.py não encontrado! Verifique a instalação do app.');
            return;
        }

        const args = [script, inputDir];
        console.log(`🚀 Executando: ${pythonCmd} ${args.join(' ')}`);
        runPythonScript(event, 'repack', pythonCmd, args, { cwd: outputDir });
    });

    // ========== SELEÇÃO MANUAL DO PYTHON ==========
    ipcMain.handle('set-python-path', async () => {
        const filters = process.platform === 'win32'
            ? [{ name: 'Python', extensions: ['exe'] }]
            : [{ name: 'Todos os arquivos', extensions: ['*'] }];

        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Selecione o executável do Python',
            filters,
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const selected = result.filePaths[0];
            try {
                execSync(`"${selected}" --version`, { stdio: 'pipe', timeout: 5000 });
                savePythonPath(selected);
                return { success: true, path: selected };
            } catch (e) {
                return { success: false, error: 'Arquivo inválido' };
            }
        }
        return { success: false, error: 'Cancelado' };
    });
}

// ========== EXECUÇÃO DO SCRIPT PYTHON ==========
function runPythonScript(event, channelPrefix, cmd, args, options = {}) {
    const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8'
    };

    // NUNCA usar shell:true — quebra caminhos com espaços no Windows.
    // O Node.js spawn() passa cada elemento do array args como argumento
    // separado para o processo, sem passar por shell, então espaços são seguros.
    //
    // Se cmd for um comando simples como 'py' ou 'python' (não caminho absoluto),
    // o Node resolve via PATH automaticamente sem precisar de shell.
    //
    // Todos os caminhos (script, pacPath, outDir) chegam aqui como strings
    // individuais no array args — o spawn os trata como um único argumento cada.

    console.log(`▶ spawn cmd: "${cmd}"`);
    console.log(`▶ spawn args:`, args);

    const proc = spawn(cmd, args, {
        cwd: options.cwd || process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false   // ← CRÍTICO: false evita que o cmd.exe quebre os caminhos
    });

    let stdoutBuffer = '';

    proc.stdout.on('data', (data) => {
        const str = data.toString('utf-8');
        stdoutBuffer += str;

        // Envia linha por linha
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop(); // Guarda linha incompleta

        lines.filter(l => l.trim()).forEach(line => {
            event.reply(`${channelPrefix}-log`, { type: 'stdout', text: line });

            // Detecta progresso (ex: "Progresso: 45%" ou "45%")
            const match = line.match(/(\d+)%/);
            if (match) {
                event.reply(`${channelPrefix}-progress`, parseInt(match[1]));
            }
        });
    });

    proc.stderr.on('data', (data) => {
        const str = data.toString('utf-8');
        str.split(/\r?\n/).filter(l => l.trim()).forEach(line => {
            event.reply(`${channelPrefix}-log`, { type: 'stderr', text: line });
        });
    });

    proc.on('close', (code) => {
        // Envia qualquer linha restante no buffer
        if (stdoutBuffer.trim()) {
            event.reply(`${channelPrefix}-log`, { type: 'stdout', text: stdoutBuffer });
        }
        console.log(`✅ Script finalizado com código: ${code}`);
        event.reply(`${channelPrefix}-complete`, { success: code === 0, code });
    });

    proc.on('error', (err) => {
        console.error(`❌ Erro ao executar script:`, err);
        let msg = err.message;
        if (err.code === 'ENOENT') {
            msg = `Python não encontrado: "${cmd}"\n\nSoluções:\n1. Instale Python em python.org (marque "Add to PATH")\n2. Reinicie o app após instalar`;
        }
        event.reply(`${channelPrefix}-error`, msg);
    });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});