# 📦 Unisoc SPD PAC Tool

> Ferramenta open source para extrair e reempacotar firmware `.pac` de dispositivos Android com chipset **Unisoc / Spreadtrum**.

[![GitHub](https://img.shields.io/badge/GitHub-ViniciusSouza22-181717?logo=github)](https://github.com/ViniciusSouza22/Unisoc-SPD-PAC-Tool)
![Plataforma](https://img.shields.io/badge/plataforma-Windows%20%7C%20Linux-0078D4?logo=windows)
![Electron](https://img.shields.io/badge/electron-28.x-47848F?logo=electron)
![Python](https://img.shields.io/badge/python-3.8%2B-3776AB?logo=python)
![Licença](https://img.shields.io/badge/licença-Open%20Source-green)
![Versão](https://img.shields.io/badge/versão-1.0.0-orange)

---

## 🧩 O que é isso?

O **Unisoc SPD PAC Tool** é uma aplicação desktop desenvolvida com **Electron + Python** que permite:

- ✅ Extrair partições de arquivos `.pac`
- ✅ Reempacotar firmware modificado
- ✅ Detectar blobs (ELF, ZIP, GZ, IMG, XML, etc.)
- ✅ Exportar áreas não mapeadas (`--dump-all`)

---

## 🚀 Instalação

```bash
git clone https://github.com/ViniciusSouza22/Unisoc-SPD-PAC-Tool.git
cd Unisoc-SPD-PAC-Tool
npm install
npm start
```

---

## 📦 Build (Windows e Linux)

### Instalar dependências

```bash
npm install --save-dev electron electron-builder
```

### Comandos

```bash
npm start
npm run build:win
npm run build:linux
npm run build:all
```

---

## 📁 Saída

```
dist/
├── Unisoc SPD PAC Tool Setup.exe
├── Unisoc-SPD-PAC-Tool.AppImage
├── unisoc-spd-pac-tool.deb
```

---

## 📄 Licença

Open Source
