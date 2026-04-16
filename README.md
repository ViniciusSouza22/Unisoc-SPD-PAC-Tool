# 📦 Unisoc SPD PAC Tool

> Ferramenta open source para extrair e reempacotar firmware `.pac` de dispositivos Android com chipset **Unisoc / Spreadtrum**.

[![GitHub](https://img.shields.io/badge/GitHub-ViniciusSouza22-181717?logo=github)](https://github.com/ViniciusSouza22/Unisoc-SPD-PAC-Tool)
![Plataforma](https://img.shields.io/badge/plataforma-Windows-0078D4?logo=windows)
![Electron](https://img.shields.io/badge/electron-28.x-47848F?logo=electron)
![Python](https://img.shields.io/badge/python-3.8%2B-3776AB?logo=python)
![Licença](https://img.shields.io/badge/licença-Open%20Source-green)
![Versão](https://img.shields.io/badge/versão-1.0.0-orange)

---

## 🧩 O que é isso?

O **Unisoc SPD PAC Tool** é uma aplicação desktop desenvolvida com **Electron + Python** que permite:

- **Extrair** todas as partições de um arquivo `.pac` (formato de firmware Unisoc/Spreadtrum)
- **Reempacotar** partições modificadas de volta em um novo arquivo `.pac`
- **Detectar blobs** embutidos (ELF, ZIP, GZ, imagens Android, XMLs, etc.)
- **Exportar áreas não mapeadas** do firmware (`--dump-all`)

Ideal para desenvolvedores, entusiastas de ROM customizada e profissionais de manutenção de dispositivos Android com chipsets Unisoc SC9xxx, T6xx, T7xx, etc.

---

## 🖥️ Interface

A interface possui **três painéis principais**:

| Painel | Função |
|---|---|
| 📂 Arquivo PAC | Selecionar e extrair partições do `.pac` |
| 🖥️ Log de Extração | Acompanhar o progresso em tempo real |
| 📦 Empacotar PAC | Selecionar pasta e gerar novo `.pac` |

---

## ⚙️ Requisitos

### Obrigatório

- **[Python 3.8+](https://www.python.org/downloads/)**
  - ⚠️ Durante a instalação no Windows, marque a opção **"Add Python to PATH"**
  - Sem Python instalado, a ferramenta **não funcionará**

### Para rodar o código-fonte

- **[Node.js 18+](https://nodejs.org/)**
- **npm** (incluído com o Node.js)

---

## 🚀 Instalação

### ▶️ Opção 1 — Executável compilado (recomendado)

> ⚠️ **Disponível apenas para Windows no momento.**

| Plataforma | Download |
|---|---|
| 🪟 Windows | [**Baixar Unisoc PAC Tool 1.0.0 Setup.exe**](https://drive.google.com/file/d/1R-XB5erWXh51_glMMB1LYCfvXC6kTehm/view?usp=drive_link) |

Após baixar, execute o instalador e siga os passos. Depois de instalar, **certifique-se de ter o Python instalado** antes de abrir o app.

---

### 🛠️ Opção 2 — Rodar pelo código-fonte

```bash
# 1. Clone o repositório
git clone https://github.com/ViniciusSouza22/Unisoc-SPD-PAC-Tool.git
cd Unisoc-SPD-PAC-Tool

# 2. Instale as dependências Node
npm install

# 3. Inicie o app
npm start
```

---

## 📋 Como usar

### Extrair um arquivo `.pac`

1. Abra o app
2. No painel esquerdo, clique em **"Selecionar arquivo .PAC"**
3. Escolha o arquivo `.pac` do firmware
4. Clique em **"Extrair PAC"** e selecione a pasta de destino
5. Acompanhe o progresso no painel de log central
6. As partições serão salvas na pasta escolhida

### Reempacotar partições

1. No painel direito, clique em **"Selecionar pasta de partições"**
2. Selecione a pasta com os arquivos extraídos (e modificados)
3. Clique em **"Selecionar pasta de destino"** para definir onde o novo `.pac` será salvo
4. Clique em **"Empacotar PAC"**
5. Aguarde a conclusão — o novo `.pac` estará pronto na pasta de destino

---

## 📁 Estrutura do Projeto

```
Unisoc-SPD-PAC-Tool/
├── main.js                  # Processo principal do Electron (IPC, Python, janela)
├── renderer.js              # Interface e eventos do frontend
├── index.html               # Layout principal da UI
├── style.css                # Estilos da aplicação
├── extractor.py             # Script Python de extração de partições
├── pack_pac_enhanced.py     # Script Python de reempacotamento
├── assets/
│   ├── icon.ico             # Ícone Windows
│   └── icon.png             # Ícone Linux
└── package.json             # Configuração do projeto e build
```

---

## 🐍 Sobre os scripts Python

O app usa dois scripts Python que são executados via `subprocess` pelo Electron:

### `extractor.py`

Extrai partições de um `.pac`:

```bash
python extractor.py <arquivo.pac> [pasta_saida] [opções]
```

| Opção | Descrição |
|---|---|
| `--dump-all` | Extrai também áreas não mapeadas (gaps entre partições) |
| `--blobs` | Detecta e extrai blobs por assinatura (ELF, ZIP, GZ, etc.) |
| `--debug` | Exibe informações do cabeçalho PAC |
| `-q` / `--quiet` | Modo silencioso |

### `pack_pac_enhanced.py`

Reempacota uma pasta de partições em um novo `.pac`:

```bash
python pack_pac_enhanced.py <pasta_partições>
```

---

## 🔬 Formatos suportados

O extrator reconhece e processa os seguintes tipos de blob dentro do PAC:

- `.gz` — Gzip
- `.zip` — ZIP
- `.elf` — Executável ELF
- `.img` — Imagens Android (`ANDROID!`, `IMAGEWTY`, `AVB0`, `CHROMEOS`)
- `.vbmeta` — Android Verified Boot
- `.bmp` — Imagens bitmap (`BM`, `LOGO`)
- `.xml` — Arquivos de configuração

---

## 🏗️ Compilar o projeto

Certifique-se de ter o `electron-builder` instalado (`npm install`), depois:


```bash
# primerio instalar 
npm install 

# Windows
npm run build:win

# Linux
npm run build:linux

# Ambos
npm run build:all
```

Os arquivos compilados serão gerados na pasta `dist/`.

---

## ❗ Solução de Problemas

**Python não encontrado ao abrir o app**

O app tentará detectar automaticamente o Python. Se não encontrar:
1. Uma janela de aviso será exibida
2. Clique em **"Selecionar..."** para apontar manualmente o `python.exe`
3. O caminho será salvo para as próximas execuções

Se preferir, instale o Python em [python.org](https://www.python.org/downloads/) com a opção **"Add to PATH"** marcada e reinicie o app.

---

**O PAC não é reconhecido**

- Verifique se o arquivo não está corrompido
- O app exibirá um aviso se o `magic number` do cabeçalho PAC for diferente do esperado (`0xfffafffa`), mas ainda tentará processar o arquivo (compatível com formatos PAC mais recentes)

---

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:

- Abrir uma **issue** com bugs ou sugestões em [github.com/ViniciusSouza22/Unisoc-SPD-PAC-Tool](https://github.com/ViniciusSouza22/Unisoc-SPD-PAC-Tool)
- Enviar um **pull request** com melhorias
- Melhorar o suporte a novos modelos de PAC Unisoc

---

## 📄 Licença

Este projeto é **open source**. Consulte o arquivo `LICENSE` para mais detalhes.

---

## ⚠️ Aviso Legal

Esta ferramenta é destinada exclusivamente para fins educacionais, desenvolvimento e manutenção de dispositivos próprios. O uso para fins ilegais ou que violem os termos de serviço dos fabricantes é de responsabilidade exclusiva do usuário.
